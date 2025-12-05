# Iconos PWA - Instrucciones

Para completar la configuración PWA, necesitas crear los iconos en diferentes tamaños.

## Ubicación
Coloca todos los iconos en: `/public/icons/`

## Tamaños requeridos
- `icon-72x72.png` (72x72px)
- `icon-96x96.png` (96x96px)
- `icon-128x128.png` (128x128px)
- `icon-144x144.png` (144x144px)
- `icon-152x152.png` (152x152px)
- `icon-192x192.png` (192x192px) - **Requerido mínimo**
- `icon-384x384.png` (384x384px)
- `icon-512x512.png` (512x512px) - **Requerido mínimo**

## Cómo generar los iconos

### Opción 1: Usar una herramienta online
1. Visita https://realfavicongenerator.net/ o https://www.pwabuilder.com/imageGenerator
2. Sube tu logo/imagen principal (recomendado: 512x512px o mayor)
3. Genera todos los tamaños necesarios
4. Descarga y coloca en `/public/icons/`

### Opción 2: Usar ImageMagick (línea de comandos)
```bash
# Asegúrate de tener ImageMagick instalado
# Crea una imagen base llamada icon-base.png (512x512px o mayor)

mkdir -p public/icons

# Genera todos los tamaños
convert icon-base.png -resize 72x72 public/icons/icon-72x72.png
convert icon-base.png -resize 96x96 public/icons/icon-96x96.png
convert icon-base.png -resize 128x128 public/icons/icon-128x128.png
convert icon-base.png -resize 144x144 public/icons/icon-144x144.png
convert icon-base.png -resize 152x152 public/icons/icon-152x152.png
convert icon-base.png -resize 192x192 public/icons/icon-192x192.png
convert icon-base.png -resize 384x384 public/icons/icon-384x384.png
convert icon-base.png -resize 512x512 public/icons/icon-512x512.png
```

### Opción 3: Usar el logo existente
Si tienes el logo de Estudia Seguro, puedes usarlo como base:
- URL del logo: https://storage.googleapis.com/msgsndr/IRGxH3YhbSBNF8NVepYv/media/67ec02b6379294639cf06e08.png
- Descárgalo y redimensiona a los tamaños requeridos

## Notas importantes
- Los iconos deben ser cuadrados (1:1)
- Formato: PNG con fondo transparente o sólido
- El icono de 192x192px es el mínimo requerido para Android
- El icono de 512x512px es el mínimo requerido para Chrome
- Los iconos deben ser "maskable" (con padding seguro del 20% para evitar recortes)

## Verificación
Una vez creados los iconos, verifica que:
1. Todos los archivos existen en `/public/icons/`
2. El `manifest.json` referencia correctamente los iconos
3. La app se puede instalar en dispositivos móviles



