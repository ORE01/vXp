# IPC FLOW – Wie Aktionen durch die App laufen

## 1. Mentales Modell (Merksatz)

UI ruft → Main hört → Handler arbeitet → Main antwortet → UI reagiert

---

## 2. Rollen

### Renderer (UI)
- Darf KEINE DB
- Darf KEIN FS
- Sendet nur Events

Beispiel:
```js
api.send('delete-portfolio-everywhere', { port_name })



## KONKRETER DATENFLUSS – DealsMain → Bildschirm
