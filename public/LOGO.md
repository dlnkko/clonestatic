# Logo en admirror

## Problema del PNG con fondo negro

Si tu logo es **gris/negro sobre fondo negro**, al pegarlo en una web clara verás un “cuadro negro”. Eso no es un bug del sitio: el PNG **no tiene transparencia**.

## Opciones (de mejor a peor)

1. **SVG / componente vectorial (recomendado)**  
   El landing y el dashboard usan `AdmirrorLogo` en `app/components/AdmirrorLogo.tsx`. Se ve bien en fondo oscuro y claro sin caja.

2. **PNG con fondo transparente**  
   Exporta desde Figma/Canva/Photoshop: **Export → PNG → transparent background**.  
   Guárdalo como `public/logo.png` (reemplaza el actual).

3. **Dos versiones**  
   - `logo-light.png` — logo claro para header oscuro  
   - `logo-dark.png` — logo oscuro para secciones claras  

4. **Solo para hero oscuro**  
   Tu PNG actual puede usarse **solo** donde el fondo sea negro (`#000` o `#060a14`), igual que en tu mockup.

## Usar tu archivo adjunto

Copia tu PNG a:

```
public/logo-custom.png
```

Y en `AdmirrorLogo` puedes añadir un `<Image src="/logo-custom.png" />` con `className` solo en secciones oscuras, o tras quitar el fondo en un editor.
