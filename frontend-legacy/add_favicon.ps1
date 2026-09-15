$files = Get-ChildItem -Path 'd:\Files\EDUCATION\tshirt-business\frontend' -Filter *.html -Recurse
foreach ($f in $files) {
    try {
        $content = [System.IO.File]::ReadAllText($f.FullName)
        if ($content -notmatch '<link rel="icon"') {
            $newContent = $content -replace '(<title>.*?</title>)', "`$1`r`n    <link rel=`"icon`" type=`"image/png`" href=`"images/LOGO-.png`">"
            [System.IO.File]::WriteAllText($f.FullName, $newContent)
            Write-Host "Updated $($f.Name)"
        }
    } catch {
        Write-Host "Failed to update $($f.Name): $_"
    }
}
