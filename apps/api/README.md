```txt
npm install
npm run dev
```

Before running Wrangler commands, provide the D1 database ID outside source control by setting one of:

- `D1_DATABASE_ID`
- `CF_D1_DATABASE_ID`
- `CLOUDFLARE_D1_DATABASE_ID`

You can set it in your shell or in `apps/api/.dev.vars`. The repository now keeps `wrangler.template.jsonc`, and `npm run dev`, `npm run deploy`, and `npm run cf-typegen` generate a local ignored `wrangler.jsonc` automatically.

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Populate the required `app_settings` rows in D1 after importing `src/db/schema.sql`.
Use `src/db/app-settings.example.sql` as the template and provide environment-specific values for:

- `office_name`
- `office_lat`
- `office_lng`
- `office_radius_meters`
- `frontend_url`

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
