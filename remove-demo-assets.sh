#!/bin/bash

echo "=== REMOVENDO IMAGENS DE DEMO ==="
echo ""

# Remover diretórios de imagens de demo
for dir in brands clients companies; do
  if [ -d "public/assets/images/$dir" ]; then
    rm -rf "public/assets/images/$dir"
    echo "✓ Removido: images/$dir/"
  fi
done

# Remover fontes que não estão sendo usadas
echo ""
echo "=== LIMPANDO FONTES NÃO UTILIZADAS ==="
find public/assets/fonts -type f | while read font; do
  fontname=$(basename "$font")
  if ! grep -qr "$fontname" public/*.html; then
    rm "$font"
    echo "✓ Removido: $(echo $font | sed 's|public/||')"
  fi
done

# Verificar quanto economizamos
echo ""
echo "=== RESUMO FINAL ==="
du -sh public/assets/
echo ""
echo "Arquivos CSS restantes:"
ls -lh public/assets/css/*.min.css 2>/dev/null | awk '{print $9, $5}'
echo ""
echo "Arquivos JS restantes (principais):"
ls -lh public/assets/js/*.js 2>/dev/null | awk '{print $9, $5}'
echo ""
echo "Bibliotecas restantes:"
ls public/assets/libs/
