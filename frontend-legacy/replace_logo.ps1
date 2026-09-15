$files = Get-ChildItem -Path 'd:\Files\EDUCATION\tshirt-business\frontend' -Filter *.html -Recurse
foreach ($f in $files) {
    (Get-Content $f.FullName) -replace '>DYD-Cloths<', '>D<span style="color: var(--primary)">Y</span>D-Cloths<' | Set-Content $f.FullName
}
Write-Host "Replacement complete."
