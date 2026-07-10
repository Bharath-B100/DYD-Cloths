$files = Get-ChildItem -Path 'd:\Files\EDUCATION\tshirt-business\frontend' -Filter *.html -Recurse
foreach ($f in $files) {
    try {
        $content = [System.IO.File]::ReadAllText($f.FullName)
        if ($content -match 'assets/images/favicon_cropped\.png') {
            # Use regex to match the old img tag
            $newContent = $content -replace '<img src="assets/images/favicon_cropped\.png"[^>]*>', '<img src="images/LOGO-.png" class="logo-icon" style="height:40px; width:auto; border-radius:4px; object-fit:contain;">'
            [System.IO.File]::WriteAllText($f.FullName, $newContent)
            Write-Host "Updated $($f.Name)"
        }
    } catch {
        Write-Host "Failed to update $($f.Name): $_"
    }
}
