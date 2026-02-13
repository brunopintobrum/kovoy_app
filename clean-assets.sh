#!/bin/bash

# Arquivos referenciados (mantém estes)
REFERENCED=$(cat << 'REFS'
/assets/css/app.min.css
/assets/css/bootstrap.min.css
/assets/css/groups-custom.css
/assets/css/icons.min.css
/assets/images/favicon.ico
/assets/images/logo.svg
/assets/images/logo-dark.png
/assets/images/logo-light.png
/assets/images/logo-light.svg
/assets/images/megamenu-img.png
/assets/images/profile-img.png
/assets/images/users/default-avatar.svg
/assets/js/app.js
/assets/js/pages/auth-2-carousel.init.js
/assets/js/pages/two-step-verification.init.js
/assets/js/pages/validation.init.js
/assets/js/sentry-init.js
/assets/libs/bootstrap/js/bootstrap.bundle.min.js
/assets/libs/jquery/jquery.min.js
/assets/libs/owl.carousel/owl.carousel.min.js
REFS
)

echo "Arquivos a remover:"
# Remover diretórios não utilizados de libs
UNUSED_LIBS=(
  "apexcharts"
  "bootstrap-datepicker"
  "bootstrap-editable"
  "bootstrap-filestyle2"
  "bootstrap-maxlength"
  "bootstrap-rating"
  "bootstrap-timepicker"
  "bootstrap-touchspin"
  "chance"
  "chart.js"
  "datatables.net"
  "datatables.net-autofill"
  "datatables.net-autofill-bs4"
  "datatables.net-autofill-bs5"
  "datatables.net-buttons"
  "datatables.net-buttons-bs4"
  "datatables.net-buttons-bs5"
  "datatables.net-colreorder"
  "datatables.net-colreorder-bs4"
  "datatables.net-colreorder-bs5"
  "datatables.net-fixedcolumns"
  "datatables.net-fixedcolumns-bs4"
  "datatables.net-fixedcolumns-bs5"
  "datatables.net-fixedheader"
  "datatables.net-fixedheader-bs4"
  "datatables.net-fixedheader-bs5"
  "datatables.net-keytable"
  "datatables.net-keytable-bs4"
  "datatables.net-keytable-bs5"
  "datatables.net-responsive"
  "datatables.net-responsive-bs4"
  "datatables.net-responsive-bs5"
  "datatables.net-rowgroup"
  "datatables.net-rowgroup-bs4"
  "datatables.net-rowgroup-bs5"
  "datatables.net-rowreorder"
  "datatables.net-rowreorder-bs4"
  "datatables.net-rowreorder-bs5"
  "datatables.net-scroller"
  "datatables.net-scroller-bs4"
  "datatables.net-scroller-bs5"
  "datatables.net-select"
  "datatables.net-select-bs4"
  "datatables.net-select-bs5"
)

for lib in "${UNUSED_LIBS[@]}"; do
  if [ -d "public/assets/libs/$lib" ]; then
    echo "- public/assets/libs/$lib"
  fi
done

# Listar arquivos JS em pages/ que não estão referenciados
echo ""
echo "Arquivos JS em pages/ não referenciados:"
for file in public/assets/js/pages/*.js; do
  filename=$(basename "$file")
  if ! grep -q "/assets/js/pages/$filename" referenced-assets.txt; then
    echo "- $file"
  fi
done
