# Deployment auf kumo

Diese Anleitung ist fuer dich geschrieben, nicht fuer eine Automatik. **Alle Schritte fuehrst du
selbst auf dem Server aus.** Es gibt keinen Deploy-Befehl von aussen und keinen Zugriff auf kumo
aus der Entwicklungsumgebung.

Reihenfolge und Konventionen folgen `kumo Server Runbook` → «Adding a new service».

---

## Eckdaten

| | |
|---|---|
| Auth-Muster | **Fall A**, auth-lose Oberflaeche hinter Authelia forwardAuth |
| Kategorie | `apps` |
| Serverpfad | `/opt/kumo/services/apps/learning-app/` |
| Container | `learning-app` |
| Interner Port | `3000` |
| Domain | `learning.braendle.tech` |
| Volume | `./data` → `/data` (SQLite, WAL) |
| Health | `GET /api/health` |
| Zeitzone | `Europe/Zurich` |

---

## Schritt 0, Voraussetzungen pruefen

```bash
docker network ls | grep proxy
free -m
df -h /
```

Das `proxy`-Netz muss existieren. Bei `free -m` interessiert die Spalte `available`: der
Nuxt-Build braucht ungefaehr 1.5 GB. Wenn weniger als etwa 2 GB frei sind, lege vor dem Build
Swap an (Schritt 6a).

## Schritt 1, DNS

Cloudflare, Zone `braendle.tech`: A-Record `learning` auf kumos IP, **proxied (orange)**.
Die Zone steht bereits auf SSL **Full (Strict)**, Traefik holt den Let's-Encrypt-Cert per DNS-01
automatisch.

## Schritt 2, Ordner

```bash
mkdir -p /opt/kumo/services/apps/learning-app
cd /opt/kumo/services/apps/learning-app
```

## Schritt 3, Quellcode holen

Das Repo ist privat, kumo braucht also einen eigenen Read-only-Zugang. Deploy Key statt
persoenlichem Token, damit der Zugriff auf genau dieses eine Repo begrenzt ist.

```bash
ssh-keygen -t ed25519 -C 'kumo-learning-app' -f ~/.ssh/learning-app_deploy -N ''
cat ~/.ssh/learning-app_deploy.pub
```

Den ausgegebenen oeffentlichen Schluessel auf GitHub im Repo `BWizard06/learning-app` unter
**Settings → Deploy keys → Add deploy key** eintragen, **ohne** Schreibrechte.

```bash
cat >> ~/.ssh/config <<'CONF'
Host github-learning-app
    HostName github.com
    User git
    IdentityFile ~/.ssh/learning-app_deploy
    IdentitiesOnly yes
CONF

git clone git@github-learning-app:BWizard06/learning-app.git src
```

Der private Deploy Key gehoert in **Proton Pass**.

## Schritt 4, compose.yaml

```bash
cp src/deploy/compose.yaml ./compose.yaml
mkdir -p data
```

In `compose.yaml` steht `context: .`; zeige es auf den geklonten Code:

```yaml
    build:
      context: ./src
      dockerfile: Dockerfile
```

Pruefe die drei Dinge, die sonst still fehlschlagen:

- **kein `ports:`-Block.** Docker umgeht UFW fuer veroeffentlichte Ports, nur Traefik darf 80/443
  halten.
- **`user: '1001:1001'`.** `ben` hat auf kumo uid 1001, der Standarduser im Node-Image hat 1000.
  Passt das nicht zusammen, kann der Container `./data` nicht beschreiben. Genau diese Falle hat
  schon bei LLDAP zugeschlagen.
- **`image:` mit exakter Version**, nie `:latest`.

```bash
chown -R 1001:1001 data
```

## Schritt 5, Authelia-Regel

**Ohne diesen Schritt liefert die Domain einen harten 403, ohne Login, auch fuer dich.**
`default_policy` steht auf `deny`, jede Domain braucht ihre eigene Regel.

In `/opt/kumo/services/infra/authelia/config/configuration.yml` unter `access_control.rules`:

```yaml
    - domain: 'learning.braendle.tech'
      policy: 'one_factor'
      subject: 'group:lldap_admin'
```

```bash
cd /opt/kumo/services/infra/authelia && docker compose restart authelia
```

**Die Authelia-Session bleibt bewusst unveraendert** (eine Stunde, fuenf Minuten Inaktivitaet).
Die App faengt eine abgelaufene Sitzung selbst ab: Ergebnisse bleiben in der Outbox liegen, ein
Banner meldet es, nach dem naechsten Login wird nachgetragen. Es geht dabei nichts verloren.

## Schritt 6, Bauen und starten

### 6a, Swap, falls noetig

Nur wenn Schritt 0 wenig freien Speicher gezeigt hat. Reversibel.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
free -m
```

Dauerhaft machen mit `echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`.
Rueckbau: `sudo swapoff /swapfile && sudo rm /swapfile` und die fstab-Zeile entfernen.

### 6b, Build und Start

```bash
cd /opt/kumo/services/apps/learning-app
docker compose build
docker compose up -d
docker compose logs -f learning-app
```

Der Build dauert einige Minuten. `better-sqlite3` bringt einen fertigen `linux-x64`-Prebuild mit,
es wird also nichts kompiliert. Die Datenbankmigrationen laufen beim ersten Start automatisch.

Wenn der Build am Speicher scheitert, ist der Ausweg billig: das Image in GitHub Actions bauen
lassen und im `compose.yaml` `build:` durch `image: ghcr.io/bwizard06/learning-app:<version>`
ersetzen. Sonst aendert sich nichts, das Dockerfile funktioniert fuer beide Wege.

## Schritt 7, Monitoring

- **Beszel** und **Dozzle** finden den Container von selbst, nichts zu tun.
- **Uptime Kuma**: *Add New Monitor* → HTTP(s) → URL `http://learning-app:3000/api/health` →
  Intervall 60 s → **Retries 2** → ntfy-Benachrichtigung aktivieren.
  Die interne URL umgeht Traefik und Authelia, deshalb kann hier kein 401 auftreten wie damals
  bei Dozzle.

## Schritt 8, Verify

- [ ] `https://learning.braendle.tech` leitet auf die Authelia-Anmeldung
- [ ] Nach dem Login laedt die App
- [ ] Zertifikat gueltig
- [ ] `docker compose ps` zeigt `healthy`
- [ ] Uptime-Kuma-Monitor gruen
- [ ] Ein Durchgang laesst sich spielen und das Ergebnis erscheint in der Statistik
- [ ] Auf dem Handy zum Startbildschirm hinzufuegen, App startet im Standalone-Modus
- [ ] Flugmodus an, ein Durchgang spielen, Flugmodus aus, Ergebnis wird nachgetragen
- [ ] Deploy Key in **Proton Pass** abgelegt

---

## Umgebungsvariablen

| Variable | Vorgabe | Bedeutung |
|---|---|---|
| `NUXT_DB_PATH` | `/data/learning.db` | Pfad der SQLite-Datei im Container |
| `NUXT_MIGRATIONS_DIR` | `/app/migrations` | Ordner mit den Drizzle-Migrationen |
| `NITRO_PORT` | `3000` | interner Port |
| `NITRO_HOST` | `0.0.0.0` | Bind-Adresse im Container |
| `TZ` | `Europe/Zurich` | Zeitzone, relevant fuer Tagesgrenzen und Streak |

Es gibt **keine Passphrase und kein Auth-Secret**, weil Authelia die einzige Tuer ist.

## Update

```bash
cd /opt/kumo/services/apps/learning-app/src
git pull
cd ..
```

Version in `compose.yaml` hochziehen (`image: learning-app:0.2.0`), dann

```bash
docker compose build
docker compose up -d
docker compose ps
```

Rueckbau auf die vorherige Version: die alte Versionsnummer wieder eintragen und
`docker compose up -d`. Das alte Image liegt lokal noch vor, solange es nicht mit
`docker image prune` entfernt wurde.

## Daten

**Es gibt bewusst keine Backups.** Das war eine ausdrueckliche Entscheidung. Wenn du Daten
sichern willst, hol sie dir jederzeit selbst:

```bash
curl -o export.json https://learning.braendle.tech/api/export
curl -o sessions.csv 'https://learning.braendle.tech/api/export?format=csv&table=sessions'
curl -o trials.csv 'https://learning.braendle.tech/api/export?format=csv&table=trials'
```

Aus dem Browser heraus geht das direkt, weil die Authelia-Sitzung dann schon steht.

Die Datenbank selbst liegt in `/opt/kumo/services/apps/learning-app/data/learning.db` und laeuft
im WAL-Modus. Fuer eine Kopie im laufenden Betrieb:

```bash
docker compose exec learning-app node -e "process.exit(0)"
sqlite3 data/learning.db "VACUUM INTO '/tmp/learning-backup.db'"
```

## Rueckbau

```bash
cd /opt/kumo/services/apps/learning-app
docker compose down
```

Vollstaendig entfernen: zusaetzlich den Ordner loeschen, den Cloudflare-Record entfernen, die
`access_control`-Regel aus der Authelia-Konfiguration nehmen und Authelia neu starten, den
Uptime-Kuma-Monitor loeschen und den Deploy Key auf GitHub widerrufen.
