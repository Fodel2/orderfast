import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          rel="apple-touch-icon"
          href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAADG0lEQVR4nO3YoWpcCRiG4T/LTtzY2pCYQCEy1DUXEF8I5AYSGFXT+2ggvhBVV3oRcwujxsdOXUTWBdbP7sCb55HnjPjEy+Fnjtbr9etAxF+HHgD7JGhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpPx96AFFv3//np8/f85isZiXl5f58uXLXF9fz8zM1dXVfPz48e23nz9/npubm0NNzRH0nq3X6/n169c8PDzMcrmc3W43X79+nQ8fPszl5eUsFot5fHw89MwsJ8eePT09zWq1muVyOTMzy+VyVqvV/Pjx48DL3gdB79l2u53z8/N/PTs/P5/tdnugRe+Lk+N/8Pr6OkdHRzMz8/LyMnd3d2/vvn37NicnJ4ealiPoPTs9PZ3NZjMXFxdvzzabzZydnc3MuKH/Y06OPbu9vZ3v37/Pnz9/ZmZmt9vNw8PD3N7eHnjZ++ALvWefPn2a5+fnub+/n+Pj47e/7S4vLw897V04Wq/Xr4ceAfvi5CBF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImpR/AMCaU+7PMYclAAAAAElFTkSuQmCC"
        />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
