$exclude = @('node_modules', '.git', 'images', 'assets\images')
$files = Get-ChildItem -Path 'd:\Files\EDUCATION\tshirt-business' -File -Recurse | Where-Object { 
    $path = $_.FullName
    $skip = $false
    foreach ($ex in $exclude) {
        if ($path -match "\\$ex\\") { $skip = $true; break }
    }
    -not $skip
}

foreach ($f in $files) {
    if ($f.Extension -match "\.(html|js|css|md|json)$") {
        try {
            $content = [System.IO.File]::ReadAllText($f.FullName)
            $newContent = $content -creplace 'Cloths', 'Clothes' -creplace 'cloths', 'clothes' -creplace 'CLOTHS', 'CLOTHES'
            if ($content -ne $newContent) {
                [System.IO.File]::WriteAllText($f.FullName, $newContent)
                Write-Host "Updated $($f.Name)"
            }
        } catch {
            Write-Host "Failed: $($f.Name)"
        }
    }
}
