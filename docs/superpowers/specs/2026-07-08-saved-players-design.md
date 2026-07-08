# Kişisel Oyuncu Listesi ("Oyuncularım") — Tasarım

**Tarih:** 2026-07-08
**Durum:** Onaylandı, plan bekliyor

## Amaç

Kullanıcı her draftta aynı isimleri elle yeniden yazmasın. Her kullanıcıya özel,
kalıcı bir "hazır oyuncu listesi" tutulur. Bir drafta oyuncu eklendiğinde isim
otomatik olarak bu listeye kaydedilir; kullanıcı ayrıca ayrı bir "Oyuncularım"
ekranından elle isim ekleyip silebilir. Aynı isim (büyük/küçük harf duyarsız)
listede zaten varsa tekrar eklenmez.

## Kararlar (brainstorming sonucu)

- **Lobi UX:** Otomatik-tamamlama input + açılıp kapanan "listemden seç" çip paneli.
- **Kayıt modeli:** Drafta eklendiğinde otomatik kayıt **+** ayrı yönetim ekranı.
- **Dedup:** `trim` uygulanır ve büyük/küçük harf yok sayılır (`lower(name)`).
  İsim ilk yazıldığı hâliyle saklanır ve gösterilir.
- **Yönetim:** Ayrı `/players` sayfası (lobide modal değil).
- **Düzenleme (edit):** Kapsam dışı — sadece ekle/sil.

## Kapsam dışı (YAGNI)

- Draft havuzunun kendi içinde mükerrer isim engeli (ayrı konu).
- Kayıtlı isim düzenleme (rename).
- Liste paylaşımı / ekip listeleri.

## Veri modeli

Yeni tablo: `public.saved_players`

```
id          uuid primary key default gen_random_uuid()
user_id     uuid not null references auth.users (id) on delete cascade
name        text not null check (char_length(trim(name)) between 1 and 60)
created_at  timestamptz not null default now()
```

İndeksler / kısıtlar:

- `unique index saved_players_user_name_idx on saved_players (user_id, lower(name))`
  → kullanıcı başına case-insensitive tekillik (dedup'ın temeli).
- `index saved_players_user_created_idx on saved_players (user_id, created_at)`
  → listeleme sırası.

RLS:

- `saved_players_select`: `user_id = auth.uid()` (kullanıcı sadece kendi listesini görür).
- Yazma işlemleri SECURITY DEFINER RPC üzerinden yapılır (aşağıya bakın); doğrudan
  `insert`/`delete` için RLS yazma politikası tanımlanmaz (mevcut kod deseniyle tutarlı:
  yazmalar RPC'den, okumalar RLS'li select ile).

## RPC'ler ve otomatik kayıt (migration `0008`)

Tümü `language plpgsql`, `security definer`, `set search_path = public`
(mevcut RPC deseniyle birebir).

1. `add_saved_player(p_name text) returns void`
   - `trim(p_name)` boşsa `raise exception 'name required'`.
   - `char_length(trim(p_name)) > 60` ise `raise exception` (60 sınırı).
   - `insert into saved_players (user_id, name) values (auth.uid(), trim(p_name))
      on conflict (user_id, lower(name)) do nothing;`
   - Zaten varsa sessizce yok sayılır (hata değil).

2. `remove_saved_player(p_id uuid) returns void`
   - `delete from saved_players where id = p_id and user_id = auth.uid();`
   - Başka kullanıcının satırını silemez (RLS + explicit user_id koşulu).

3. `add_player(...)` **değişikliği** (aynı migration'da yeniden tanımlanır)
   - Mevcut mantık korunur (üyelik, lobby, 12 sınırı, trim).
   - Oyuncu `players`'a eklendikten sonra, **aynı transaction içinde**:
     ```
     insert into saved_players (user_id, name)
     values (auth.uid(), trim(p_name))
     on conflict (user_id, lower(name)) do nothing;
     ```
   - Böylece drafta ekleme = listeye otomatik kayıt; tek round-trip, atomik.
   - Not: Kaydeden = `auth.uid()` (havuza ekleyen kaptan). Her kaptanın kendi listesi
     büyür; bu istenen davranış.

Migration dosyası bu değişiklikleri içerir. Elle uygulama (Supabase Dashboard →
SQL Editor), dosya sırasına göre (`0008…`). `add_player` dönüş tipi değişmediği için
`drop function` gerekmez; `create or replace` yeterli.

## Sunucu action'ları (`src/server/actions/`)

Yeni dosya `saved-players.ts` (veya `players.ts` içine eklenebilir):

- `addSavedPlayer(name: string): Promise<ActionResult>`
  - `requireUser`, `trim`, boş/60 doğrulaması, `checkLimit(user.id, "pool")`.
  - `supabase.rpc("add_saved_player", { p_name })`.
  - `revalidatePath("/players")`, `ok(undefined)`.
- `removeSavedPlayer(id: string): Promise<ActionResult>`
  - `requireUser`, `checkLimit(user.id, "pool")`.
  - `supabase.rpc("remove_saved_player", { p_id: id })`.
  - `revalidatePath("/players")`, `ok(undefined)`.

Rate limiting mevcut `"pool"` grubuna dahil edilir (yeni grup açılmaz).

## Repository (`src/server/repositories/`)

- `listSavedPlayers(): Promise<SavedPlayer[]>`
  - `supabase.from("saved_players").select("*").order("created_at", { ascending: true })`.
  - RLS `user_id = auth.uid()` filtrelemeyi garanti eder.
- Tip: `SavedPlayer = { id: string; name: string; created_at: string }`.
  `database.types.ts`'e `saved_players` tablosu + `JoinDraftCode` yanına elle eklenir.

## Lobi UI (`src/components/draft/player-pool-editor.tsx`)

- Room sayfası (`src/app/drafts/[id]/room/...`) draft + oyuncular yanında
  `listSavedPlayers()` sonucunu da çeker ve `Lobby` → `PlayerPoolEditor`'a `savedPlayers`
  prop'u olarak geçirir.
- Input **otomatik-tamamlama**'ya dönüşür: kullanıcı yazdıkça `savedPlayers` içinden
  case-insensitive eşleşenler bir öneri listesinde gösterilir. Öneri seçilince o isim
  havuza eklenir (`addPlayer`); serbest metinle yeni isim de yazılabilir.
- Input'un altında **"Listemden seç"** açılıp kapanan çip paneli:
  - Her kayıtlı isim tıklanabilir çip.
  - Tıklayınca `addPlayer(draftId, name)` çağrılır.
  - Havuzda zaten olan isim (case-insensitive) çipi **pasif/soluk** gösterilir.
  - Havuz doluysa (12) tüm çipler pasiftir.
- Ekleme sonrası otomatik kayıt DB tarafında (`add_player` RPC) olur; UI ekstra çağrı
  yapmaz. Yeni eklenen isim bir sonraki sayfa yenilemesinde/`revalidatePath` ile çip
  panelinde de görünür.

## Yönetim ekranı — `/players` ("Oyuncularım")

- Yeni route: `src/app/players/page.tsx` (server component).
  - `requireUser` (giriş yoksa `/`'a veya auth'a yönlendirme — mevcut desen).
  - `listSavedPlayers()` ile listeyi çeker.
- Client bileşen `saved-players-editor.tsx`:
  - Üstte isim ekleme input'u + "Ekle" butonu → `addSavedPlayer`.
  - Altında isim listesi; her satırda sil (X) → `removeSavedPlayer`.
  - Boş durum mesajı ("Henüz kayıtlı oyuncun yok").
  - Hatalar `toast.error` ile (mevcut desen).
- Dashboard'a (`src/app/dashboard/page.tsx`) "Oyuncularım" linki eklenir.

## Hata durumları

- Boş/60+ isim: action seviyesinde reddedilir (mevcut `addPlayer` deseniyle aynı mesajlar).
- Dedup çakışması: hata değil; sessizce yok sayılır (kullanıcı için "eklendi" gibi görünür,
  liste değişmez). UI mükerrer göstermez.
- Rate limit: mevcut `RATE_LIMIT_MESSAGE`.

## Test / doğrulama

- `add_saved_player` iki kez aynı isimle (farklı harf büyüklüğü) çağrılınca tek satır kalır.
- Bir drafta oyuncu eklenince `saved_players`'da o isim belirir; ikinci draftta aynı isim
  tekrar eklenince mükerrer olmaz.
- `remove_saved_player` başka kullanıcının satırını silemez.
- Lobi çip paneli: havuzdaki isim pasif, havuz doluyken hepsi pasif.
- Migration `0008` prod'a uygulanmadan `add_saved_player` çağrısı 404/uyumsuzluk verir —
  deploy öncesi Dashboard'da uygulanmalı (SERVICES.local.md hatırlatması geçerli).

## Migration uygulama notu

`0008` prod'a **elle** uygulanır (Supabase Dashboard → SQL Editor), koda deploy
etmeden önce/ile birlikte. `saved_players` tablosu, indeksler, RLS, üç RPC
(`add_saved_player`, `remove_saved_player`, `add_player` değişikliği) tek dosyada.
