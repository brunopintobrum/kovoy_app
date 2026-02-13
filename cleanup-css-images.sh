#!/bin/bash

echo "=== LIMPANDO CSS E IMAGENS NÃO UTILIZADAS ==="
echo ""

# Verificar quais CSS estão sendo referenciados
echo "CSS referenciados em HTML:"
grep -hro '/assets/css/[^"'"'"']*' public/*.html | sort -u

echo ""
echo "CSS encontrados no diretório:"
find public/assets/css -type f -name "*.css"

echo ""
echo "Imagens em assets:"
find public/assets/images -type f | head -20

# Remover CSS não utilizados que sejam variantes RTL ou dark
echo ""
echo "Removendo CSS não utilizados..."
for file in public/assets/css/*.rtl.* public/assets/css/*.dark.* public/assets/css/*-dark.* public/assets/css/*-rtl.*; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "✓ Removido: $(basename $file)"
  fi
done

# Remover imagens de demo do template que não estejam sendo usadas
echo ""
echo "Procurando imagens não referenciadas..."
for img in public/assets/images/*; do
  if [ -f "$img" ]; then
    imgname=$(basename "$img")
    if ! grep -qr "$imgname" public/*.html; then
      rm "$img"
      echo "✓ Removido: images/$imgname"
    fi
  fi
done

echo ""
du -sh public/assets/
