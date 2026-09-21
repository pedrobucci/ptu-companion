package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"embed"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const appVersion = "2.1.0-beta.19"

//go:embed runtime_bundle.zip
var bundleFS embed.FS

func hidden(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return cmd
}

func showMessage(title, message string) {
	escapedTitle := strings.ReplaceAll(title, "'", "''")
	escapedMessage := strings.ReplaceAll(message, "'", "''")
	script := fmt.Sprintf("Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('%s','%s') | Out-Null", escapedMessage, escapedTitle)
	_ = hidden(exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script)).Run()
}

func runtimeBundleMarker() string {
	payload, err := bundleFS.ReadFile("runtime_bundle.zip")
	if err != nil {
		return appVersion
	}
	sum := sha256.Sum256(payload)
	return fmt.Sprintf("%s:%x", appVersion, sum[:8])
}

func unzipBundle(destination string) error {
	payload, err := bundleFS.ReadFile("runtime_bundle.zip")
	if err != nil {
		return err
	}
	zr, err := zip.NewReader(bytes.NewReader(payload), int64(len(payload)))
	if err != nil {
		return err
	}
	root, err := filepath.Abs(destination)
	if err != nil {
		return err
	}
	for _, f := range zr.File {
		target := filepath.Join(root, filepath.FromSlash(f.Name))
		clean, err := filepath.Abs(target)
		if err != nil {
			return err
		}
		if clean != root && !strings.HasPrefix(clean, root+string(os.PathSeparator)) {
			return fmt.Errorf("invalid bundled path: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(clean, 0755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(clean), 0755); err != nil {
			return err
		}
		src, err := f.Open()
		if err != nil {
			return err
		}
		dst, err := os.OpenFile(clean, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, f.Mode())
		if err != nil {
			src.Close()
			return err
		}
		_, copyErr := io.Copy(dst, src)
		closeErr := dst.Close()
		src.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
	}
	return os.WriteFile(filepath.Join(root, ".installed-version"), []byte(runtimeBundleMarker()), 0644)
}

func copyFile(source, destination string) error {
	src, err := os.Open(source)
	if err != nil {
		return err
	}
	defer src.Close()
	if err := os.MkdirAll(filepath.Dir(destination), 0755); err != nil {
		return err
	}
	dst, err := os.OpenFile(destination, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(dst, src)
	closeErr := dst.Close()
	if copyErr != nil {
		return copyErr
	}
	return closeErr
}

func migrateSiblingData(dataDir string) {
	target := filepath.Join(dataDir, "ptu_companion.sqlite3")
	if _, err := os.Stat(target); err == nil {
		return
	}
	exe, err := os.Executable()
	if err != nil {
		return
	}
	sibling := filepath.Join(filepath.Dir(exe), "data")
	source := filepath.Join(sibling, "ptu_companion.sqlite3")
	if _, err := os.Stat(source); err != nil {
		return
	}
	for _, suffix := range []string{"", "-wal", "-shm"} {
		from := source + suffix
		to := target + suffix
		if _, err := os.Stat(from); err == nil {
			_ = copyFile(from, to)
		}
	}
}

func ensureRuntime(localAppData string) (string, string, error) {
	base := filepath.Join(localAppData, "PTU Companion Beta")
	runtime := filepath.Join(base, "runtime", appVersion)
	data := filepath.Join(base, "data")
	marker := filepath.Join(runtime, ".installed-version")
	installed, _ := os.ReadFile(marker)
	if strings.TrimSpace(string(installed)) != runtimeBundleMarker() {
		_ = os.RemoveAll(runtime)
		if err := os.MkdirAll(runtime, 0755); err != nil {
			return "", "", err
		}
		if err := unzipBundle(runtime); err != nil {
			return "", "", err
		}
	}
	if err := os.MkdirAll(data, 0755); err != nil {
		return "", "", err
	}
	return runtime, data, nil
}

var nodeVersionRx = regexp.MustCompile(`v?(\d+)\.`)

func validNode(path string) bool {
	if path == "" {
		return false
	}
	out, err := hidden(exec.Command(path, "--version")).CombinedOutput()
	if err != nil {
		return false
	}
	m := nodeVersionRx.FindStringSubmatch(strings.TrimSpace(string(out)))
	if len(m) < 2 {
		return false
	}
	major, _ := strconv.Atoi(m[1])
	return major >= 22
}

func nodeCandidates() []string {
	var out []string
	if p, err := exec.LookPath("node.exe"); err == nil {
		out = append(out, p)
	}
	if p, err := exec.LookPath("node"); err == nil {
		out = append(out, p)
	}
	for _, base := range []string{os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"), os.Getenv("LOCALAPPDATA")} {
		if base == "" {
			continue
		}
		out = append(out,
			filepath.Join(base, "nodejs", "node.exe"),
			filepath.Join(base, "Programs", "nodejs", "node.exe"),
		)
	}
	return out
}

func findNode() string {
	seen := map[string]bool{}
	for _, p := range nodeCandidates() {
		k := strings.ToLower(p)
		if seen[k] {
			continue
		}
		seen[k] = true
		if validNode(p) {
			return p
		}
	}
	return ""
}

func installNode() string {
	winget, err := exec.LookPath("winget.exe")
	if err != nil {
		winget, _ = exec.LookPath("winget")
	}
	if winget == "" {
		return ""
	}
	cmd := hidden(exec.Command(winget, "install", "--id", "OpenJS.NodeJS.LTS", "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements"))
	_ = cmd.Run()
	return findNode()
}

func edgePath() string {
	if p, err := exec.LookPath("msedge.exe"); err == nil {
		return p
	}
	candidates := []string{
		filepath.Join(os.Getenv("ProgramFiles(x86)"), "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(os.Getenv("ProgramFiles"), "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "Edge", "Application", "msedge.exe"),
	}
	for _, p := range candidates {
		if p != "" {
			if _, err := os.Stat(p); err == nil {
				return p
			}
		}
	}
	return ""
}

func freePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func waitForServer(port int, timeout time.Duration) bool {
	client := http.Client{Timeout: 750 * time.Millisecond}
	deadline := time.Now().Add(timeout)
	url := fmt.Sprintf("http://127.0.0.1:%d/api/health", port)
	for time.Now().Before(deadline) {
		resp, err := client.Get(url)
		if err == nil {
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			if resp.StatusCode == 200 {
				return true
			}
		}
		time.Sleep(250 * time.Millisecond)
	}
	return false
}

func main() {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		showMessage("PTU Companion Beta", "Windows LOCALAPPDATA could not be located.")
		return
	}
	runtime, dataDir, err := ensureRuntime(localAppData)
	if err != nil {
		showMessage("PTU Companion Beta", "The application files could not be installed:\n"+err.Error())
		return
	}
	// When the EXE is distributed inside an upgraded project folder, import the existing
	// SQLite campaign once. The standalone EXE otherwise starts from the neutral seed.
	migrateSiblingData(dataDir)

	node := findNode()
	if node == "" {
		showMessage("PTU Companion Beta", "Node.js 22+ is required for the local PTU rules server. The beta will now try to install the current Node.js LTS using Windows Package Manager (winget).")
		node = installNode()
	}
	if node == "" {
		showMessage("PTU Companion Beta", "Node.js 22+ could not be found or installed automatically. Install the current Node.js LTS and open PTU Companion Beta again.")
		return
	}

	edge := edgePath()
	if edge == "" {
		showMessage("PTU Companion Beta", "Microsoft Edge/WebView runtime was not found. Windows 10/11 normally includes Microsoft Edge; install or repair Edge and try again.")
		return
	}

	port, err := freePort()
	if err != nil {
		showMessage("PTU Companion Beta", "A local port could not be allocated:\n"+err.Error())
		return
	}

	server := hidden(exec.Command(node, "server.mjs"))
	server.Dir = runtime
	server.Env = append(os.Environ(), fmt.Sprintf("PTU_PORT=%d", port), "PTU_DATA_DIR="+dataDir, "PTU_DESKTOP_SESSION=1")
	logDir := filepath.Join(localAppData, "PTU Companion Beta")
	_ = os.MkdirAll(logDir, 0755)
	if logFile, e := os.OpenFile(filepath.Join(logDir, "server.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644); e == nil {
		defer logFile.Close()
		server.Stdout = logFile
		server.Stderr = logFile
	}
	if err := server.Start(); err != nil {
		showMessage("PTU Companion Beta", "The local rules server could not start:\n"+err.Error())
		return
	}

	if !waitForServer(port, 25*time.Second) {
		_ = server.Process.Kill()
		_, _ = server.Process.Wait()
		showMessage("PTU Companion Beta", "The local rules server did not become ready. See server.log in %LOCALAPPDATA%\\PTU Companion Beta for details.")
		return
	}

	profileDir := filepath.Join(localAppData, "PTU Companion Beta", "DesktopProfile")
	_ = os.MkdirAll(profileDir, 0755)
	appURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	browser := exec.Command(edge,
		"--app="+appURL,
		"--user-data-dir="+profileDir,
		"--no-first-run",
		"--disable-default-apps",
		"--disable-background-mode",
		"--disable-features=msEdgeSidebarV2",
		"--start-maximized",
	)
	// Chromium may hand the app window to another Edge process and terminate this
	// command immediately. Do not tie the rules-server lifetime to browser.Wait().
	// The UI heartbeat now owns that lifetime and the server exits after the app is closed.
	browser.SysProcAttr = &syscall.SysProcAttr{HideWindow: false}
	if err := browser.Start(); err != nil {
		_ = server.Process.Kill()
		_, _ = server.Process.Wait()
		showMessage("PTU Companion Beta", "The desktop window could not be opened:\n"+err.Error())
		return
	}
	if browser.Process != nil {
		_ = browser.Process.Release()
	}
	if server.Process != nil {
		_ = server.Process.Release()
	}
}
