import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Favicon */}
        <link
          rel="icon"
          type="image/png"
          sizes="96x96"
          href="/favicon.png"
        />

        <link
          rel="shortcut icon"
          href="/favicon.png"
        />

        <link
          rel="apple-touch-icon"
          href="/favicon.png"
        />

        {/* Canonical URL */}
        <link
          rel="canonical"
          href="https://noahanimalclinic.com"
        />

        {/* SEO */}
        <title>
          Noah Animal Clinic | Advanced Veterinary Care in Hyderabad
        </title>

        <meta
          name="description"
          content="Noah Animal Clinic provides expert veterinary care, pet wellness, vaccinations, surgery, grooming and emergency pet services in Hyderabad."
        />

        {/* Open Graph */}
        <meta
          property="og:title"
          content="Noah Animal Clinic"
        />

        <meta
          property="og:description"
          content="Advanced veterinary care in Hyderabad."
        />

        <meta
          property="og:image"
          content="https://noahanimalclinic.com/favicon.png"
        />
      </Head>

      <Component {...pageProps} />
    </>
  );
}