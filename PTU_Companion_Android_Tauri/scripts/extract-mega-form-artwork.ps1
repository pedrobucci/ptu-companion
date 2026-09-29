param(
  [Parameter(Mandatory=$true)][string]$PdfPath,
  [switch]$Force
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$inventory=Get-Content -LiteralPath (Join-Path $repoRoot 'docs\data\PTU_FORMS_INVENTORY.json') -Raw | ConvertFrom-Json
$poppler=(Get-Command pdfimages -ErrorAction Stop).Source
$groups=$inventory.mega_forms | Group-Object { $_.species.source_page } | Sort-Object { [int]$_.Name }
$jobs=@()
foreach($group in $groups){
  $page=[int]$group.Name
  $listing=@(& $poppler -list -f $page -l $page $PdfPath 2>&1)
  $images=@()
  foreach($line in $listing){
    $parts=([string]$line).Trim() -split '\s+'
    if($parts.Count -lt 16 -or $parts[2] -ne 'image' -or [int]$parts[1] -lt 4 -or [int]$parts[3] -lt 120 -or [int]$parts[4] -lt 120){continue}
    $size=$parts[14]
    $bytes=if($size.EndsWith('K')){[double]$size.TrimEnd('K')*1024}elseif($size.EndsWith('B')){[double]$size.TrimEnd('B')}else{0}
    if($bytes -gt 2048){$images+=@{number=[int]$parts[1];width=[int]$parts[3];height=[int]$parts[4]}}
  }
  $expected=$group.Group.Count+1
  if($images.Count -ne $expected){throw "Page ${page}: found $($images.Count) artwork candidates; expected $expected (base + Mega form art)."}
  $forms=@($group.Group)
  for($i=1;$i -lt $images.Count;$i++){
    $form=$forms[$i-1]
    $suffix=if($form.form_suffix){'-'+([string]$form.form_suffix).ToLowerInvariant()}else{''}
    $stem="mega-$($form.species.id)$suffix"
    $jobs+=@{page=$page;imageNumber=$images[$i].number;stem=$stem;width=$images[$i].width;height=$images[$i].height}
  }
}
if($jobs.Count -ne 48){throw "Expected 48 Mega art mappings; found $($jobs.Count)."}

$targets=@(
  (Join-Path $repoRoot 'PTU_Companion_Android_Tauri\www\creatures\forms'),
  (Join-Path $repoRoot 'PTU_Companion_Windows_Source\static-preview\creatures\forms')
)
foreach($target in $targets){
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  if(-not $Force){
    foreach($job in $jobs){if(Test-Path -LiteralPath (Join-Path $target "$($job.stem).png")){throw "Artwork exists already; pass -Force to replace: $($job.stem).png"}}
  }
}
$tempBase='C:\ptu-mega-art-temp'
New-Item -ItemType Directory -Path $tempBase -Force | Out-Null
$tempRoot=Join-Path $tempBase ('ptu-mega-art-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot | Out-Null
try{
  foreach($sourceGroup in $groups){
    $page=[int]$sourceGroup.Name
    $pageJobs=@($jobs | Where-Object { $_.page -eq $page })
    $prefix=Join-Path $tempRoot "page-$page"
    & $poppler -png -f $page -l $page $PdfPath $prefix
    if($LASTEXITCODE -ne 0){throw "pdfimages failed on page $page."}
    foreach($job in $pageJobs){
      $number=[int]$job.imageNumber
      $colorPath="$prefix-$('{0:D3}' -f $number).png"
      $maskPath="$prefix-$('{0:D3}' -f ($number+1)).png"
      if(-not (Test-Path -LiteralPath $colorPath) -or -not (Test-Path -LiteralPath $maskPath)){throw "Missing image/soft-mask pair for $($job.stem) on page $page."}
      $color=[Drawing.Bitmap]::FromFile($colorPath)
      $mask=[Drawing.Bitmap]::FromFile($maskPath)
      $output=New-Object Drawing.Bitmap($color.Width,$color.Height,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try{
        if($color.Width -ne $mask.Width -or $color.Height -ne $mask.Height){throw "Image/mask dimensions differ for $($job.stem)."}
        for($y=0;$y -lt $color.Height;$y++){
          for($x=0;$x -lt $color.Width;$x++){
            $pixel=$color.GetPixel($x,$y); $alpha=$mask.GetPixel($x,$y).R
            $output.SetPixel($x,$y,[Drawing.Color]::FromArgb($alpha,$pixel.R,$pixel.G,$pixel.B))
          }
        }
        $alphaMin=255; $alphaMax=0
        for($y=0;$y -lt $output.Height;$y+=8){for($x=0;$x -lt $output.Width;$x+=8){$a=$output.GetPixel($x,$y).A;if($a -lt $alphaMin){$alphaMin=$a};if($a -gt $alphaMax){$alphaMax=$a}}}
        if($alphaMin -eq $alphaMax){throw "Soft-mask transparency check failed for $($job.stem)."}
        foreach($target in $targets){$output.Save((Join-Path $target "$($job.stem).png"),[Drawing.Imaging.ImageFormat]::Png)}
      }finally{$output.Dispose();$mask.Dispose();$color.Dispose()}
    }
  }
}finally{
  $resolvedTemp=(Resolve-Path -LiteralPath $tempRoot).Path
  $resolvedBase=[IO.Path]::GetFullPath($tempBase).TrimEnd('\')+'\'
  if($resolvedTemp.StartsWith($resolvedBase,[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $resolvedTemp -Recurse -Force}
}
Write-Output "Extracted and soft-mask-composited $($jobs.Count) Mega form images from the supplied PokéDex into Android and Windows assets."
