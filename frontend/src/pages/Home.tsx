import Hero from '../components/Hero'
import ProductMatrix from '../components/ProductMatrix'
import Mission from '../components/Mission'
import KnowledgeBase from '../components/KnowledgeBase'
import Tools from '../components/Tools'
import Trust from '../components/Trust'
import Seo, { SITE_URL, BRAND } from '../components/Seo'

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND,
  legalName: 'ОсОО «MF PRO»',
  url: SITE_URL,
  description:
    'Маркетинг и финансы для бизнеса в Кыргызстане: бизнес-планы, финмодели, франшизы, инвестиции и готовые бизнесы.',
  areaServed: 'KG',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Бишкек',
    addressCountry: 'KG',
  },
}

export default function Home() {
  return (
    <>
      <Seo
        title="Маркетинг и финансы для бизнеса в Кыргызстане"
        description="Помогаем запускать и масштабировать бизнес в Кыргызстане: бизнес-планы, финмодели, франшизы, инвестиции и готовые бизнесы. Бесплатная консультация эксперта."
        path="/"
        jsonLd={orgSchema}
      />
      <Hero />
      <ProductMatrix />
      <Mission />
      <KnowledgeBase />
      <Tools />
      <Trust />
    </>
  )
}
