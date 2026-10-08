import { Head } from 'vite-react-ssg'

// При деплое замените SITE_URL на реальный домен.
export const SITE_URL = 'https://kpioshsu.com'
export const BRAND = 'Smart Capital Partners'

type SeoProps = {
  title: string
  description: string
  path: string
  type?: 'website' | 'article'
  jsonLd?: object
  noindex?: boolean
}

export default function Seo({ title, description, path, type = 'website', jsonLd, noindex }: SeoProps) {
  const url = SITE_URL + path
  const fullTitle = `${title} — ${BRAND}`
  const image = `${SITE_URL}/og-image.png`

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={url} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={BRAND} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="ru_RU" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Head>
  )
}
