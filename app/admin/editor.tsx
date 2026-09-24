"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { locales, localeNames, type Locale, type Content } from "@/lib/model";
import { Upload } from "@/components/upload";
import { authClient } from "@/lib/auth-client";
import {
  loadEditor,
  saveDraft,
  saveShop,
  publishDraft,
  restoreDraft,
  retryRefresh,
  inviteAdministrator,
} from "./actions";
type Loaded = Awaited<ReturnType<typeof loadEditor>>;
export function Editor({ email, owner }: { email: string; owner: boolean }) {
  const [locale, setLocale] = useState<Locale>("en"),
    [data, setData] = useState<Loaded | null>(null),
    [draft, setDraft] = useState<Content | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [enabled, setEnabled] = useState(false),
    [dirty, setDirty] = useState(false);
  async function reload(l: Locale) {
    const next = await loadEditor(l);
    setData(next);
    setDraft(next.page?.draft || null);
    setEnabled(next.page?.enabled || false);
    setDirty(false);
  }
  useEffect(() => {
    let live = true;
    loadEditor(locale)
      .then((next) => {
        if (live) {
          setData(next);
          setDraft(next.page?.draft || null);
          setEnabled(next.page?.enabled || false);
          setDirty(false);
        }
      })
      .catch((e) => setMessage(String(e)));
    return () => {
      live = false;
    };
  }, [locale]);
  useEffect(() => {
    const stop = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [dirty]);
  async function run(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await work();
      setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  function change(next: Content) {
    setDraft(next);
    setDirty(true);
  }
  const field = (key: keyof Content, label: string, long = false) =>
    typeof draft?.[key] === "string" ? (
      <label key={key}>
        {label}
        {long ? (
          <textarea
            value={draft[key] as string}
            onChange={(e) => change({ ...draft, [key]: e.target.value })}
          />
        ) : (
          <input
            value={draft[key] as string}
            onChange={(e) => change({ ...draft, [key]: e.target.value })}
          />
        )}
      </label>
    ) : null;
  return (
    <main className="admin-shell">
      <p className="eyebrow">ZEUDI DI PALMA / CONTENT STUDIO</p>
      <h1>Your portfolio.</h1>
      <div className="admin-actions">
        <span>{email}</span>
        <button
          onClick={() =>
            run(async () => {
              await authClient.signOut();
              location.assign("/admin/login");
            }, "")
          }
        >
          Sign out
        </button>
        <Link href="/en">View site ↗</Link>
      </div>
      {owner && (
        <form
          className="admin-card"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(
              () =>
                inviteAdministrator(
                  String(f.get("email")),
                  String(f.get("name")),
                ),
              "Invitation sent.",
            );
          }}
        >
          <h2>Invite an administrator</h2>
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <button disabled={busy}>Send setup email</button>
        </form>
      )}
      <label>
        Language
        <select
          value={locale}
          disabled={busy}
          onChange={(e) => {
            if (!dirty || confirm("Discard unsaved changes?"))
              setLocale(e.target.value as Locale);
          }}
        >
          {locales.map((l) => (
            <option key={l} value={l}>
              {localeNames[l]}
            </option>
          ))}
        </select>
      </label>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!draft || !data?.page ? (
        <p>No content has been imported for this language yet.</p>
      ) : (
        <>
          <div className="admin-actions">
            <button
              disabled={busy || !dirty}
              onClick={() =>
                run(async () => {
                  const version = await saveDraft(
                    locale,
                    draft,
                    data.page!.version,
                  );
                  setData({ ...data, page: { ...data.page!, version, draft } });
                  setDirty(false);
                }, "Draft saved.")
              }
            >
              Save draft
            </button>
            <a
              target="_blank"
              rel="noreferrer"
              href={`/admin/preview/${locale}`}
            >
              Preview saved draft ↗
            </a>
            <button
              disabled={busy || dirty || !data.settings}
              onClick={() =>
                run(async () => {
                  await publishDraft(
                    locale,
                    data.page!.version,
                    data.settings!.version,
                    enabled,
                  );
                  await reload(locale);
                }, "Published. The website cache is updating.")
              }
            >
              Publish saved draft
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(() => reload(locale), "Reloaded latest content.")
              }
            >
              Reload
            </button>
            <span>
              {dirty ? "Unsaved changes" : `Version ${data.page.version}`}
            </span>
          </div>
          <label>
            <span>Include this language on the published site</span>
            <input
              style={{ width: 20 }}
              type="checkbox"
              checked={enabled}
              disabled={locale === "en"}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </label>
          <fieldset>
            <legend>Website and SEO</legend>
            {field("name", "Name")}
            {field("location", "Location")}
            {field("description", "Search description", true)}
            {Object.entries(draft.nav).map(([key, value]) => (
              <label key={key}>
                {key} navigation label
                <input
                  value={value}
                  onChange={(e) =>
                    change({
                      ...draft,
                      nav: { ...draft.nav, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Biography</legend>
            {field("aboutTitle", "Section label")}
            {field("aboutLead", "Introduction", true)}
            {draft.chapters.map((c, i) => (
              <div className="admin-card" key={c.id}>
                {(["label", "title", "body"] as const).map((key) => (
                  <label key={key}>
                    {key}
                    <textarea
                      value={c[key]}
                      onChange={(e) =>
                        change({
                          ...draft,
                          chapters: draft.chapters.map((entry, j) =>
                            j === i
                              ? { ...entry, [key]: e.target.value }
                              : entry,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <button
                  onClick={() =>
                    change({
                      ...draft,
                      chapters: draft.chapters.filter((_, j) => j !== i),
                    })
                  }
                >
                  Remove chapter
                </button>
                <button
                  disabled={!i}
                  onClick={() => {
                    const chapters = [...draft.chapters];
                    [chapters[i - 1], chapters[i]] = [
                      chapters[i],
                      chapters[i - 1],
                    ];
                    change({ ...draft, chapters });
                  }}
                >
                  Move up
                </button>
                <button
                  disabled={i === draft.media.length - 1}
                  onClick={() => {
                    const media = [...draft.media];
                    [media[i], media[i + 1]] = [media[i + 1], media[i]];
                    change({ ...draft, media });
                  }}
                >
                  Move down
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                change({
                  ...draft,
                  chapters: [
                    ...draft.chapters,
                    {
                      id: crypto.randomUUID(),
                      label: "",
                      title: "New chapter",
                      body: "",
                    },
                  ],
                })
              }
            >
              Add chapter
            </button>
          </fieldset>
          <fieldset>
            <legend>Gallery and homepage</legend>
            <Upload
              onComplete={async () => {
                const next = await loadEditor(locale);
                setData({ ...data, assets: next.assets });
              }}
            />
            {draft.media.map((m, i) => (
              <div className="admin-card" key={m.id}>
                {(["title", "alt", "caption", "category"] as const).map(
                  (key) => (
                    <label key={key}>
                      {key}
                      <input
                        value={m[key]}
                        onChange={(e) =>
                          change({
                            ...draft,
                            media: draft.media.map((entry, j) =>
                              j === i
                                ? { ...entry, [key]: e.target.value }
                                : entry,
                            ),
                          })
                        }
                      />
                    </label>
                  ),
                )}
                <label>
                  Show on homepage
                  <input
                    type="checkbox"
                    checked={m.featured}
                    onChange={(e) =>
                      change({
                        ...draft,
                        media: draft.media.map((entry, j) =>
                          j === i
                            ? { ...entry, featured: e.target.checked }
                            : entry,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  disabled={!i}
                  onClick={() => {
                    const media = [...draft.media];
                    [media[i - 1], media[i]] = [media[i], media[i - 1]];
                    change({ ...draft, media });
                  }}
                >
                  Move up
                </button>
                <button
                  onClick={() =>
                    change({
                      ...draft,
                      media: draft.media.filter((_, j) => i !== j),
                    })
                  }
                >
                  Remove from page
                </button>
              </div>
            ))}
            <label>
              Add from media library
              <select
                value=""
                onChange={(e) => {
                  const m = data.assets.find((a) => a.id === e.target.value);
                  if (m) change({ ...draft, media: [...draft.media, m] });
                }}
              >
                <option value="">Choose media</option>
                {data.assets
                  .filter((a) => !draft.media.some((m) => m.id === a.id))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>Contact and social</legend>
            {field("contactTitle", "Management name")}
            {field("contactLabel", "Heading")}
            {field("contactEmail", "Contact email")}
            {draft.social.map((s, i) => (
              <div key={i}>
                <label>
                  Label
                  <input
                    value={s.label}
                    onChange={(e) =>
                      change({
                        ...draft,
                        social: draft.social.map((x, j) =>
                          i === j ? { ...x, label: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  HTTPS address
                  <input
                    value={s.url}
                    onChange={(e) =>
                      change({
                        ...draft,
                        social: draft.social.map((x, j) =>
                          i === j ? { ...x, url: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  onClick={() =>
                    change({
                      ...draft,
                      social: draft.social.filter((_, j) => i !== j),
                    })
                  }
                >
                  Remove link
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                change({
                  ...draft,
                  social: [
                    ...draft.social,
                    { label: "New link", url: "https://" },
                  ],
                })
              }
            >
              Add social link
            </button>
          </fieldset>
          <fieldset>
            <legend>Demo shop</legend>
            {field("shopTitle", "Shop heading")}
            {field("shopIntro", "Introduction", true)}
            {data.settings && (
              <>
                <p>
                  Published shop:{" "}
                  {data.settings.shopVisible ? "Visible" : "Hidden"} · Site
                  refresh: {data.settings.syncState}
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await saveShop(
                        !data.settings!.draftShopVisible,
                        data.settings!.version,
                      );
                      const settings = await loadEditor(locale);
                      setData({ ...data, settings: settings.settings });
                    }, "Shop setting saved. Publish to apply it.")
                  }
                >
                  {data.settings.draftShopVisible
                    ? "Hide shop on next publish"
                    : "Show shop on next publish"}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() => retryRefresh(), "Website refresh requested.")
                  }
                >
                  Retry website refresh
                </button>
              </>
            )}
            {draft.products.map((p, i) => (
              <div key={p.id} className="admin-card">
                {(["title", "description", "size", "condition"] as const).map(
                  (key) => (
                    <label key={key}>
                      {key}
                      <input
                        value={p[key]}
                        onChange={(e) =>
                          change({
                            ...draft,
                            products: draft.products.map((x, j) =>
                              i === j ? { ...x, [key]: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                  ),
                )}
                <label>
                  Demo price (€)
                  <input
                    type="number"
                    min="0"
                    value={p.price}
                    onChange={(e) =>
                      change({
                        ...draft,
                        products: draft.products.map((x, j) =>
                          i === j ? { ...x, price: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Image
                  <select
                    value={p.mediaId}
                    onChange={(e) =>
                      change({
                        ...draft,
                        products: draft.products.map((x, j) =>
                          i === j ? { ...x, mediaId: e.target.value } : x,
                        ),
                      })
                    }
                  >
                    <option value="">No image</option>
                    {draft.media.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Category
                  <select
                    value={p.category}
                    onChange={(e) =>
                      change({
                        ...draft,
                        products: draft.products.map((x, j) =>
                          i === j
                            ? {
                                ...x,
                                category: e.target.value as "closet" | "drop",
                              }
                            : x,
                        ),
                      })
                    }
                  >
                    <option value="closet">Closet</option>
                    <option value="drop">Drop</option>
                  </select>
                </label>
                <label>
                  Sold
                  <input
                    type="checkbox"
                    checked={p.sold}
                    onChange={(e) =>
                      change({
                        ...draft,
                        products: draft.products.map((x, j) =>
                          i === j ? { ...x, sold: e.target.checked } : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  disabled={!i}
                  onClick={() => {
                    const products = [...draft.products];
                    [products[i - 1], products[i]] = [
                      products[i],
                      products[i - 1],
                    ];
                    change({ ...draft, products });
                  }}
                >
                  Move up
                </button>
                <button
                  disabled={i === draft.products.length - 1}
                  onClick={() => {
                    const products = [...draft.products];
                    [products[i], products[i + 1]] = [
                      products[i + 1],
                      products[i],
                    ];
                    change({ ...draft, products });
                  }}
                >
                  Move down
                </button>
                <button
                  onClick={() =>
                    change({
                      ...draft,
                      products: draft.products.filter((_, j) => i !== j),
                    })
                  }
                >
                  Remove product
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                change({
                  ...draft,
                  products: [
                    ...draft.products,
                    {
                      id: crypto.randomUUID(),
                      title: "New item",
                      description: "",
                      price: 0,
                      size: "",
                      condition: "",
                      category: "closet",
                      sold: false,
                      mediaId: "",
                    },
                  ],
                })
              }
            >
              Add demo product
            </button>
          </fieldset>
          <fieldset>
            <legend>Unused media</legend>
            <p>
              Files referenced by drafts or publication history cannot be
              deleted.
            </p>
            {data.assets
              .filter((a) => !draft.media.some((m) => m.id === a.id))
              .map((a) => (
                <div className="admin-actions" key={a.id}>
                  <span>{a.title}</span>
                  <button
                    disabled={busy || dirty}
                    onClick={() =>
                      run(async () => {
                        const response = await fetch("/api/uploads/remove", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ assetId: a.id }),
                        });
                        const result = await response.json();
                        if (!response.ok) throw Error(result.error);
                        const next = await loadEditor(locale);
                        setData({ ...data, assets: next.assets });
                      }, "Unused file removed.")
                    }
                  >
                    Delete unused file
                  </button>
                </div>
              ))}
          </fieldset>
          <fieldset>
            <legend>Publication history</legend>
            {data.history.map((r) => (
              <div className="admin-actions" key={r.id}>
                <span>
                  Version {r.version} ·{" "}
                  {new Date(r.publishedAt).toLocaleString()} · {r.author}
                </span>
                <button
                  disabled={busy || dirty}
                  onClick={() =>
                    run(async () => {
                      await restoreDraft(r.id, data.page!.version);
                      await reload(locale);
                    }, "Previous publication restored as a draft.")
                  }
                >
                  Restore as draft
                </button>
              </div>
            ))}
          </fieldset>
        </>
      )}
    </main>
  );
}
