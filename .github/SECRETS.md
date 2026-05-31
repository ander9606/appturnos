# GitHub Secrets requeridos

Configurar en: GitHub → Settings → Secrets and variables → Actions

## Backend deploy

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `VPS_HOST` | IP o dominio del servidor | `123.45.67.89` |
| `VPS_USER` | Usuario SSH | `ubuntu` |
| `VPS_SSH_KEY` | Clave privada SSH (contenido completo del archivo) | `-----BEGIN...` |
| `VPS_PORT` | Puerto SSH (opcional, default 22) | `22` |

### Generar clave SSH para el deploy:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/appturnos_deploy
# Agregar la clave pública al VPS:
cat ~/.ssh/appturnos_deploy.pub >> ~/.ssh/authorized_keys  # en el VPS
# Agregar la clave privada como secret VPS_SSH_KEY:
cat ~/.ssh/appturnos_deploy  # copiar este contenido al secret
```

## Mobile (Expo / EAS)

| Secret | Descripción | Cómo obtenerlo |
|--------|-------------|----------------|
| `EXPO_TOKEN` | Token de autenticación de Expo | `eas login` → expo.dev → Account → Access Tokens |
| `EXPO_PUBLIC_API_URL` | URL del backend en producción | `https://api.tudominio.com` |

### Obtener EXPO_TOKEN:
1. Ir a https://expo.dev/accounts/[tu-usuario]/settings/access-tokens
2. Crear nuevo token con nombre "github-actions"
3. Copiarlo como secret `EXPO_TOKEN`

## Variables de entorno en el VPS

El archivo `/srv/appturnos/backend/.env` debe existir en el VPS con
los valores de producción. NO se gestiona por GitHub Actions.

Estructura recomendada en el VPS:
```
/srv/appturnos/
├── docker-compose.yml   ← del repo
├── backend/
│   ├── .env             ← NO en git, creado manualmente en el VPS
│   └── ...
```
