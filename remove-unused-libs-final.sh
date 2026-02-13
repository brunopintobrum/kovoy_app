#!/bin/bash

echo "=== IDENTIFICANDO LIBS NÃO UTILIZADAS ==="
echo ""

# Libs que são efetivamente utilizadas (verificadas no HTML)
USED_LIBS=("bootstrap" "jquery" "owl.carousel")

# Remover todas as outras libs
LIBS_DIR="public/assets/libs"
for lib in $(ls -d $LIBS_DIR/*/ 2>/dev/null); do
  lib_name=$(basename "$lib")
  
  # Verificar se está na lista de libs utilizadas
  if ! [[ " ${USED_LIBS[@]} " =~ " ${lib_name} " ]]; then
    rm -rf "$lib"
    echo "✓ Removido: libs/$lib_name"
  else
    echo "✓ Mantido: libs/$lib_name (utilizado)"
  fi
done

echo ""
du -sh public/assets/
