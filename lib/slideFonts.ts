import { useEffect, useMemo } from 'react';

export type SlideBlockFontFamily = string;

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';

export type FontFamilySelectOption = {
  value: SlideBlockFontFamily;
  label: string;
  category: FontCategory;
  googleId?: string;
  weights: number[];
  previewStack: string;
  stack?: string;
  legacy?: boolean;
};

const DEFAULT_SANS_STACK = '"Inter", "Helvetica Neue", Arial, sans-serif';
const DEFAULT_SERIF_STACK = 'Georgia, Cambria, "Times New Roman", serif';
const DEFAULT_MONO_STACK = '"Roboto Mono", "Courier New", monospace';
const DEFAULT_HANDWRITING_STACK = '"Comic Sans MS", "Segoe Script", cursive';

export const DEFAULT_TEXT_FONT_FAMILY: SlideBlockFontFamily = 'Inter';

const GOOGLE_FONT_SELECT_OPTIONS: FontFamilySelectOption[] = 
[
  { value: 'Roboto', label: 'Roboto', category: 'sans-serif', googleId: 'Roboto', weights: [300, 400, 500, 600, 700], previewStack: '"Roboto", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Roboto", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Open Sans', label: 'Open Sans', category: 'sans-serif', googleId: 'Open Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Open Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Open Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Noto Sans JP', label: 'Noto Sans Japanese', category: 'sans-serif', googleId: 'Noto Sans JP', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Sans Japanese", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Sans Japanese", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Montserrat', label: 'Montserrat', category: 'sans-serif', googleId: 'Montserrat', weights: [300, 400, 500, 600, 700], previewStack: '"Montserrat", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Montserrat", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Inter', label: 'Inter', category: 'sans-serif', googleId: 'Inter', weights: [300, 400, 500, 600, 700], previewStack: '"Inter", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Inter", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Poppins', label: 'Poppins', category: 'sans-serif', googleId: 'Poppins', weights: [300, 400, 500, 600, 700], previewStack: '"Poppins", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Poppins", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Lato', label: 'Lato', category: 'sans-serif', googleId: 'Lato', weights: [300, 400, 700], previewStack: '"Lato", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Lato", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Roboto Condensed', label: 'Roboto Condensed', category: 'sans-serif', googleId: 'Roboto Condensed', weights: [300, 400, 500, 600, 700], previewStack: '"Roboto Condensed", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Roboto Condensed", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Roboto Mono', label: 'Roboto Mono', category: 'monospace', googleId: 'Roboto Mono', weights: [300, 400, 500, 600, 700], previewStack: '"Roboto Mono", "Roboto Mono", "Courier New", monospace', stack: '"Roboto Mono", "Roboto Mono", "Courier New", monospace' },
  { value: 'Arimo', label: 'Arimo', category: 'sans-serif', googleId: 'Arimo', weights: [400, 500, 600, 700], previewStack: '"Arimo", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Arimo", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Oswald', label: 'Oswald', category: 'sans-serif', googleId: 'Oswald', weights: [300, 400, 500, 600, 700], previewStack: '"Oswald", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Oswald", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Noto Sans', label: 'Noto Sans', category: 'sans-serif', googleId: 'Noto Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Raleway', label: 'Raleway', category: 'sans-serif', googleId: 'Raleway', weights: [300, 400, 500, 600, 700], previewStack: '"Raleway", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Raleway", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Nunito', label: 'Nunito', category: 'sans-serif', googleId: 'Nunito', weights: [300, 400, 500, 600, 700], previewStack: '"Nunito", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Nunito", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Nunito Sans', label: 'Nunito Sans', category: 'sans-serif', googleId: 'Nunito Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Nunito Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Nunito Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Rubik', label: 'Rubik', category: 'sans-serif', googleId: 'Rubik', weights: [300, 400, 500, 600, 700], previewStack: '"Rubik", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Rubik", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Ubuntu', label: 'Ubuntu', category: 'sans-serif', googleId: 'Ubuntu', weights: [300, 400, 500, 700], previewStack: '"Ubuntu", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Ubuntu", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Playfair Display', label: 'Playfair Display', category: 'serif', googleId: 'Playfair Display', weights: [400, 500, 600, 700], previewStack: '"Playfair Display", Georgia, Cambria, "Times New Roman", serif', stack: '"Playfair Display", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Noto Sans KR', label: 'Noto Sans Korean', category: 'sans-serif', googleId: 'Noto Sans KR', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Sans Korean", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Sans Korean", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Merriweather', label: 'Merriweather', category: 'serif', googleId: 'Merriweather', weights: [300, 400, 500, 600, 700], previewStack: '"Merriweather", Georgia, Cambria, "Times New Roman", serif', stack: '"Merriweather", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Roboto Slab', label: 'Roboto Slab', category: 'serif', googleId: 'Roboto Slab', weights: [300, 400, 500, 600, 700], previewStack: '"Roboto Slab", Georgia, Cambria, "Times New Roman", serif', stack: '"Roboto Slab", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'DM Sans', label: 'DM Sans', category: 'sans-serif', googleId: 'DM Sans', weights: [300, 400, 500, 600, 700], previewStack: '"DM Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"DM Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Work Sans', label: 'Work Sans', category: 'sans-serif', googleId: 'Work Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Work Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Work Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Kanit', label: 'Kanit', category: 'sans-serif', googleId: 'Kanit', weights: [300, 400, 500, 600, 700], previewStack: '"Kanit", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Kanit", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'PT Sans', label: 'PT Sans', category: 'sans-serif', googleId: 'PT Sans', weights: [400, 700], previewStack: '"PT Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"PT Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Quicksand', label: 'Quicksand', category: 'sans-serif', googleId: 'Quicksand', weights: [300, 400, 500, 600, 700], previewStack: '"Quicksand", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Quicksand", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Lora', label: 'Lora', category: 'serif', googleId: 'Lora', weights: [400, 500, 600, 700], previewStack: '"Lora", Georgia, Cambria, "Times New Roman", serif', stack: '"Lora", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Noto Sans TC', label: 'Noto Sans Traditional Chinese', category: 'sans-serif', googleId: 'Noto Sans TC', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Sans Traditional Chinese", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Sans Traditional Chinese", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Mulish', label: 'Mulish', category: 'sans-serif', googleId: 'Mulish', weights: [300, 400, 500, 600, 700], previewStack: '"Mulish", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Mulish", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'IBM Plex Sans', label: 'IBM Plex Sans', category: 'sans-serif', googleId: 'IBM Plex Sans', weights: [300, 400, 500, 600, 700], previewStack: '"IBM Plex Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"IBM Plex Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Manrope', label: 'Manrope', category: 'sans-serif', googleId: 'Manrope', weights: [300, 400, 500, 600, 700], previewStack: '"Manrope", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Manrope", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Fira Sans', label: 'Fira Sans', category: 'sans-serif', googleId: 'Fira Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Fira Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Fira Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Barlow', label: 'Barlow', category: 'sans-serif', googleId: 'Barlow', weights: [300, 400, 500, 600, 700], previewStack: '"Barlow", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Barlow", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Outfit', label: 'Outfit', category: 'sans-serif', googleId: 'Outfit', weights: [300, 400, 500, 600, 700], previewStack: '"Outfit", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Outfit", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Inconsolata', label: 'Inconsolata', category: 'monospace', googleId: 'Inconsolata', weights: [300, 400, 500, 600, 700], previewStack: '"Inconsolata", "Roboto Mono", "Courier New", monospace', stack: '"Inconsolata", "Roboto Mono", "Courier New", monospace' },
  { value: 'Titillium Web', label: 'Titillium Web', category: 'sans-serif', googleId: 'Titillium Web', weights: [300, 400, 600, 700], previewStack: '"Titillium Web", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Titillium Web", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Bebas Neue', label: 'Bebas Neue', category: 'sans-serif', googleId: 'Bebas Neue', weights: [400], previewStack: '"Bebas Neue", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Bebas Neue", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'PT Serif', label: 'PT Serif', category: 'serif', googleId: 'PT Serif', weights: [400, 700], previewStack: '"PT Serif", Georgia, Cambria, "Times New Roman", serif', stack: '"PT Serif", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Bricolage Grotesque', label: 'Bricolage Grotesque', category: 'sans-serif', googleId: 'Bricolage Grotesque', weights: [300, 400, 500, 600, 700], previewStack: '"Bricolage Grotesque", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Bricolage Grotesque", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Libre Baskerville', label: 'Libre Baskerville', category: 'serif', googleId: 'Libre Baskerville', weights: [400, 700], previewStack: '"Libre Baskerville", Georgia, Cambria, "Times New Roman", serif', stack: '"Libre Baskerville", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Karla', label: 'Karla', category: 'sans-serif', googleId: 'Karla', weights: [300, 400, 500, 600, 700], previewStack: '"Karla", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Karla", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Heebo', label: 'Heebo', category: 'sans-serif', googleId: 'Heebo', weights: [300, 400, 500, 600, 700], previewStack: '"Heebo", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Heebo", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Figtree', label: 'Figtree', category: 'sans-serif', googleId: 'Figtree', weights: [300, 400, 500, 600, 700], previewStack: '"Figtree", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Figtree", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Noto Serif', label: 'Noto Serif', category: 'serif', googleId: 'Noto Serif', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Serif", Georgia, Cambria, "Times New Roman", serif', stack: '"Noto Serif", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Prompt', label: 'Prompt', category: 'sans-serif', googleId: 'Prompt', weights: [300, 400, 500, 600, 700], previewStack: '"Prompt", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Prompt", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Hind Siliguri', label: 'Hind Siliguri', category: 'sans-serif', googleId: 'Hind Siliguri', weights: [300, 400, 500, 600, 700], previewStack: '"Hind Siliguri", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Hind Siliguri", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Jost', label: 'Jost', category: 'sans-serif', googleId: 'Jost', weights: [300, 400, 500, 600, 700], previewStack: '"Jost", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Jost", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Archivo', label: 'Archivo', category: 'sans-serif', googleId: 'Archivo', weights: [300, 400, 500, 600, 700], previewStack: '"Archivo", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Archivo", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Saira', label: 'Saira', category: 'sans-serif', googleId: 'Saira', weights: [300, 400, 500, 600, 700], previewStack: '"Saira", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Saira", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Source Sans 3', label: 'Source Sans 3', category: 'sans-serif', googleId: 'Source Sans 3', weights: [300, 400, 500, 600, 700], previewStack: '"Source Sans 3", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Source Sans 3", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Archivo Black', label: 'Archivo Black', category: 'sans-serif', googleId: 'Archivo Black', weights: [400], previewStack: '"Archivo Black", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Archivo Black", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Source Code Pro', label: 'Source Code Pro', category: 'monospace', googleId: 'Source Code Pro', weights: [300, 400, 500, 600, 700], previewStack: '"Source Code Pro", "Roboto Mono", "Courier New", monospace', stack: '"Source Code Pro", "Roboto Mono", "Courier New", monospace' },
  { value: 'Bungee', label: 'Bungee', category: 'display', googleId: 'Bungee', weights: [400], previewStack: '"Bungee", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Bungee", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Libre Franklin', label: 'Libre Franklin', category: 'sans-serif', googleId: 'Libre Franklin', weights: [300, 400, 500, 600, 700], previewStack: '"Libre Franklin", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Libre Franklin", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Dancing Script', label: 'Dancing Script', category: 'handwriting', googleId: 'Dancing Script', weights: [400, 500, 600, 700], previewStack: '"Dancing Script", "Comic Sans MS", "Segoe Script", cursive', stack: '"Dancing Script", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Mukta', label: 'Mukta', category: 'sans-serif', googleId: 'Mukta', weights: [300, 400, 500, 600, 700], previewStack: '"Mukta", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Mukta", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Josefin Sans', label: 'Josefin Sans', category: 'sans-serif', googleId: 'Josefin Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Josefin Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Josefin Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Fjalla One', label: 'Fjalla One', category: 'sans-serif', googleId: 'Fjalla One', weights: [400], previewStack: '"Fjalla One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Fjalla One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Barlow Condensed', label: 'Barlow Condensed', category: 'sans-serif', googleId: 'Barlow Condensed', weights: [300, 400, 500, 600, 700], previewStack: '"Barlow Condensed", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Barlow Condensed", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Noto Sans SC', label: 'Noto Sans Simplified Chinese', category: 'sans-serif', googleId: 'Noto Sans SC', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Sans Simplified Chinese", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Sans Simplified Chinese", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Noto Serif JP', label: 'Noto Serif Japanese', category: 'serif', googleId: 'Noto Serif JP', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Serif Japanese", Georgia, Cambria, "Times New Roman", serif', stack: '"Noto Serif Japanese", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Cabin', label: 'Cabin', category: 'sans-serif', googleId: 'Cabin', weights: [400, 500, 600, 700], previewStack: '"Cabin", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Cabin", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Schibsted Grotesk', label: 'Schibsted Grotesk', category: 'sans-serif', googleId: 'Schibsted Grotesk', weights: [400, 500, 600, 700], previewStack: '"Schibsted Grotesk", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Schibsted Grotesk", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Nanum Gothic', label: 'Nanum Gothic', category: 'sans-serif', googleId: 'Nanum Gothic', weights: [400, 700], previewStack: '"Nanum Gothic", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Nanum Gothic", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'EB Garamond', label: 'EB Garamond', category: 'serif', googleId: 'EB Garamond', weights: [400, 500, 600, 700], previewStack: '"EB Garamond", Georgia, Cambria, "Times New Roman", serif', stack: '"EB Garamond", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Dosis', label: 'Dosis', category: 'sans-serif', googleId: 'Dosis', weights: [300, 400, 500, 600, 700], previewStack: '"Dosis", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Dosis", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Share Tech', label: 'Share Tech', category: 'sans-serif', googleId: 'Share Tech', weights: [400], previewStack: '"Share Tech", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Share Tech", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Roboto Flex', label: 'Roboto Flex', category: 'sans-serif', googleId: 'Roboto Flex', weights: [300, 400, 500, 600, 700], previewStack: '"Roboto Flex", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Roboto Flex", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Anton', label: 'Anton', category: 'sans-serif', googleId: 'Anton', weights: [400], previewStack: '"Anton", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Anton", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Cairo', label: 'Cairo', category: 'sans-serif', googleId: 'Cairo', weights: [300, 400, 500, 600, 700], previewStack: '"Cairo", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Cairo", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Smooch Sans', label: 'Smooch Sans', category: 'sans-serif', googleId: 'Smooch Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Smooch Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Smooch Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', category: 'sans-serif', googleId: 'Plus Jakarta Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Plus Jakarta Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Plus Jakarta Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Public Sans', label: 'Public Sans', category: 'sans-serif', googleId: 'Public Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Public Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Public Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Bitter', label: 'Bitter', category: 'serif', googleId: 'Bitter', weights: [300, 400, 500, 600, 700], previewStack: '"Bitter", Georgia, Cambria, "Times New Roman", serif', stack: '"Bitter", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Space Grotesk', label: 'Space Grotesk', category: 'sans-serif', googleId: 'Space Grotesk', weights: [300, 400, 500, 600, 700], previewStack: '"Space Grotesk", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Space Grotesk", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Michroma', label: 'Michroma', category: 'sans-serif', googleId: 'Michroma', weights: [400], previewStack: '"Michroma", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Michroma", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Assistant', label: 'Assistant', category: 'sans-serif', googleId: 'Assistant', weights: [300, 400, 500, 600, 700], previewStack: '"Assistant", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Assistant", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Red Hat Display', label: 'Red Hat Display', category: 'sans-serif', googleId: 'Red Hat Display', weights: [300, 400, 500, 600, 700], previewStack: '"Red Hat Display", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Red Hat Display", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Exo 2', label: 'Exo 2', category: 'sans-serif', googleId: 'Exo 2', weights: [300, 400, 500, 600, 700], previewStack: '"Exo 2", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Exo 2", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Hind', label: 'Hind', category: 'sans-serif', googleId: 'Hind', weights: [300, 400, 500, 600, 700], previewStack: '"Hind", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Hind", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Alfa Slab One', label: 'Alfa Slab One', category: 'display', googleId: 'Alfa Slab One', weights: [400], previewStack: '"Alfa Slab One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Alfa Slab One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Lexend', label: 'Lexend', category: 'sans-serif', googleId: 'Lexend', weights: [300, 400, 500, 600, 700], previewStack: '"Lexend", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Lexend", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Crimson Text', label: 'Crimson Text', category: 'serif', googleId: 'Crimson Text', weights: [400, 600, 700], previewStack: '"Crimson Text", Georgia, Cambria, "Times New Roman", serif', stack: '"Crimson Text", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Pacifico', label: 'Pacifico', category: 'handwriting', googleId: 'Pacifico', weights: [400], previewStack: '"Pacifico", "Comic Sans MS", "Segoe Script", cursive', stack: '"Pacifico", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Noto Sans Telugu', label: 'Noto Sans Telugu', category: 'sans-serif', googleId: 'Noto Sans Telugu', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Sans Telugu", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Sans Telugu", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Ramabhadra', label: 'Ramabhadra', category: 'sans-serif', googleId: 'Ramabhadra', weights: [400], previewStack: '"Ramabhadra", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Ramabhadra", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'M PLUS Rounded 1c', label: 'M PLUS Rounded 1c', category: 'sans-serif', googleId: 'M PLUS Rounded 1c', weights: [300, 400, 500, 700], previewStack: '"M PLUS Rounded 1c", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"M PLUS Rounded 1c", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Anek Telugu', label: 'Anek Telugu', category: 'sans-serif', googleId: 'Anek Telugu', weights: [300, 400, 500, 600, 700], previewStack: '"Anek Telugu", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Anek Telugu", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Oxygen', label: 'Oxygen', category: 'sans-serif', googleId: 'Oxygen', weights: [300, 400, 700], previewStack: '"Oxygen", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Oxygen", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'PT Sans Narrow', label: 'PT Sans Narrow', category: 'sans-serif', googleId: 'PT Sans Narrow', weights: [400, 700], previewStack: '"PT Sans Narrow", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"PT Sans Narrow", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Urbanist', label: 'Urbanist', category: 'sans-serif', googleId: 'Urbanist', weights: [300, 400, 500, 600, 700], previewStack: '"Urbanist", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Urbanist", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Slabo 27px', label: 'Slabo 27px', category: 'serif', googleId: 'Slabo 27px', weights: [400], previewStack: '"Slabo 27px", Georgia, Cambria, "Times New Roman", serif', stack: '"Slabo 27px", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Lobster', label: 'Lobster', category: 'display', googleId: 'Lobster', weights: [400], previewStack: '"Lobster", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Lobster", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Inter Tight', label: 'Inter Tight', category: 'sans-serif', googleId: 'Inter Tight', weights: [300, 400, 500, 600, 700], previewStack: '"Inter Tight", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Inter Tight", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Comfortaa', label: 'Comfortaa', category: 'display', googleId: 'Comfortaa', weights: [300, 400, 500, 600, 700], previewStack: '"Comfortaa", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Comfortaa", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'DM Serif Display', label: 'DM Serif Display', category: 'serif', googleId: 'DM Serif Display', weights: [400], previewStack: '"DM Serif Display", Georgia, Cambria, "Times New Roman", serif', stack: '"DM Serif Display", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Arvo', label: 'Arvo', category: 'serif', googleId: 'Arvo', weights: [400, 700], previewStack: '"Arvo", Georgia, Cambria, "Times New Roman", serif', stack: '"Arvo", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Overpass', label: 'Overpass', category: 'sans-serif', googleId: 'Overpass', weights: [300, 400, 500, 600, 700], previewStack: '"Overpass", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Overpass", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Abel', label: 'Abel', category: 'sans-serif', googleId: 'Abel', weights: [400], previewStack: '"Abel", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Abel", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Tajawal', label: 'Tajawal', category: 'sans-serif', googleId: 'Tajawal', weights: [300, 400, 500, 700], previewStack: '"Tajawal", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Tajawal", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Caveat', label: 'Caveat', category: 'handwriting', googleId: 'Caveat', weights: [400, 500, 600, 700], previewStack: '"Caveat", "Comic Sans MS", "Segoe Script", cursive', stack: '"Caveat", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Rajdhani', label: 'Rajdhani', category: 'sans-serif', googleId: 'Rajdhani', weights: [300, 400, 500, 600, 700], previewStack: '"Rajdhani", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Rajdhani", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond', category: 'serif', googleId: 'Cormorant Garamond', weights: [300, 400, 500, 600, 700], previewStack: '"Cormorant Garamond", Georgia, Cambria, "Times New Roman", serif', stack: '"Cormorant Garamond", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Caprasimo', label: 'Caprasimo', category: 'display', googleId: 'Caprasimo', weights: [400], previewStack: '"Caprasimo", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Caprasimo", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Sora', label: 'Sora', category: 'sans-serif', googleId: 'Sora', weights: [300, 400, 500, 600, 700], previewStack: '"Sora", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Sora", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Changa One', label: 'Changa One', category: 'display', googleId: 'Changa One', weights: [400], previewStack: '"Changa One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Changa One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Teko', label: 'Teko', category: 'sans-serif', googleId: 'Teko', weights: [300, 400, 500, 600, 700], previewStack: '"Teko", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Teko", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Shadows Into Light', label: 'Shadows Into Light', category: 'handwriting', googleId: 'Shadows Into Light', weights: [400], previewStack: '"Shadows Into Light", "Comic Sans MS", "Segoe Script", cursive', stack: '"Shadows Into Light", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Barlow Semi Condensed', label: 'Barlow Semi Condensed', category: 'sans-serif', googleId: 'Barlow Semi Condensed', weights: [300, 400, 500, 600, 700], previewStack: '"Barlow Semi Condensed", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Barlow Semi Condensed", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Zilla Slab', label: 'Zilla Slab', category: 'serif', googleId: 'Zilla Slab', weights: [300, 400, 500, 600, 700], previewStack: '"Zilla Slab", Georgia, Cambria, "Times New Roman", serif', stack: '"Zilla Slab", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic', category: 'sans-serif', googleId: 'Noto Sans Arabic', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Sans Arabic", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Sans Arabic", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Lilita One', label: 'Lilita One', category: 'display', googleId: 'Lilita One', weights: [400], previewStack: '"Lilita One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Lilita One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Play', label: 'Play', category: 'sans-serif', googleId: 'Play', weights: [400, 700], previewStack: '"Play", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Play", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Domine', label: 'Domine', category: 'serif', googleId: 'Domine', weights: [400, 500, 600, 700], previewStack: '"Domine", Georgia, Cambria, "Times New Roman", serif', stack: '"Domine", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Gravitas One', label: 'Gravitas One', category: 'display', googleId: 'Gravitas One', weights: [400], previewStack: '"Gravitas One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Gravitas One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Satisfy', label: 'Satisfy', category: 'handwriting', googleId: 'Satisfy', weights: [400], previewStack: '"Satisfy", "Comic Sans MS", "Segoe Script", cursive', stack: '"Satisfy", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'IBM Plex Mono', label: 'IBM Plex Mono', category: 'monospace', googleId: 'IBM Plex Mono', weights: [300, 400, 500, 600, 700], previewStack: '"IBM Plex Mono", "Roboto Mono", "Courier New", monospace', stack: '"IBM Plex Mono", "Roboto Mono", "Courier New", monospace' },
  { value: 'Asap', label: 'Asap', category: 'sans-serif', googleId: 'Asap', weights: [300, 400, 500, 600, 700], previewStack: '"Asap", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Asap", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Lexend Deca', label: 'Lexend Deca', category: 'sans-serif', googleId: 'Lexend Deca', weights: [300, 400, 500, 600, 700], previewStack: '"Lexend Deca", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Lexend Deca", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Lobster Two', label: 'Lobster Two', category: 'display', googleId: 'Lobster Two', weights: [400, 700], previewStack: '"Lobster Two", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Lobster Two", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Merriweather Sans', label: 'Merriweather Sans', category: 'sans-serif', googleId: 'Merriweather Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Merriweather Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Merriweather Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Maven Pro', label: 'Maven Pro', category: 'sans-serif', googleId: 'Maven Pro', weights: [400, 500, 600, 700], previewStack: '"Maven Pro", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Maven Pro", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Luckiest Guy', label: 'Luckiest Guy', category: 'display', googleId: 'Luckiest Guy', weights: [400], previewStack: '"Luckiest Guy", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Luckiest Guy", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Abril Fatface', label: 'Abril Fatface', category: 'display', googleId: 'Abril Fatface', weights: [400], previewStack: '"Abril Fatface", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Abril Fatface", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Varela Round', label: 'Varela Round', category: 'sans-serif', googleId: 'Varela Round', weights: [400], previewStack: '"Varela Round", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Varela Round", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Questrial', label: 'Questrial', category: 'sans-serif', googleId: 'Questrial', weights: [400], previewStack: '"Questrial", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Questrial", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'M PLUS 1p', label: 'M PLUS 1p', category: 'sans-serif', googleId: 'M PLUS 1p', weights: [300, 400, 500, 700], previewStack: '"M PLUS 1p", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"M PLUS 1p", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Source Serif 4', label: 'Source Serif 4', category: 'serif', googleId: 'Source Serif 4', weights: [300, 400, 500, 600, 700], previewStack: '"Source Serif 4", Georgia, Cambria, "Times New Roman", serif', stack: '"Source Serif 4", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Be Vietnam Pro', label: 'Be Vietnam Pro', category: 'sans-serif', googleId: 'Be Vietnam Pro', weights: [300, 400, 500, 600, 700], previewStack: '"Be Vietnam Pro", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Be Vietnam Pro", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Permanent Marker', label: 'Permanent Marker', category: 'handwriting', googleId: 'Permanent Marker', weights: [400], previewStack: '"Permanent Marker", "Comic Sans MS", "Segoe Script", cursive', stack: '"Permanent Marker", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Almarai', label: 'Almarai', category: 'sans-serif', googleId: 'Almarai', weights: [300, 400, 700], previewStack: '"Almarai", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Almarai", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Noto Sans Thai', label: 'Noto Sans Thai', category: 'sans-serif', googleId: 'Noto Sans Thai', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Sans Thai", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Sans Thai", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Indie Flower', label: 'Indie Flower', category: 'handwriting', googleId: 'Indie Flower', weights: [400], previewStack: '"Indie Flower", "Comic Sans MS", "Segoe Script", cursive', stack: '"Indie Flower", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Orbitron', label: 'Orbitron', category: 'sans-serif', googleId: 'Orbitron', weights: [400, 500, 600, 700], previewStack: '"Orbitron", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Orbitron", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Cinzel', label: 'Cinzel', category: 'serif', googleId: 'Cinzel', weights: [400, 500, 600, 700], previewStack: '"Cinzel", Georgia, Cambria, "Times New Roman", serif', stack: '"Cinzel", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'IBM Plex Serif', label: 'IBM Plex Serif', category: 'serif', googleId: 'IBM Plex Serif', weights: [300, 400, 500, 600, 700], previewStack: '"IBM Plex Serif", Georgia, Cambria, "Times New Roman", serif', stack: '"IBM Plex Serif", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Nanum Myeongjo', label: 'Nanum Myeongjo', category: 'serif', googleId: 'Nanum Myeongjo', weights: [400, 700], previewStack: '"Nanum Myeongjo", Georgia, Cambria, "Times New Roman", serif', stack: '"Nanum Myeongjo", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Chakra Petch', label: 'Chakra Petch', category: 'sans-serif', googleId: 'Chakra Petch', weights: [300, 400, 500, 600, 700], previewStack: '"Chakra Petch", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Chakra Petch", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Zen Kaku Gothic New', label: 'Zen Kaku Gothic New', category: 'sans-serif', googleId: 'Zen Kaku Gothic New', weights: [300, 400, 500, 700], previewStack: '"Zen Kaku Gothic New", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Zen Kaku Gothic New", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Fira Sans Condensed', label: 'Fira Sans Condensed', category: 'sans-serif', googleId: 'Fira Sans Condensed', weights: [300, 400, 500, 600, 700], previewStack: '"Fira Sans Condensed", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Fira Sans Condensed", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Titan One', label: 'Titan One', category: 'display', googleId: 'Titan One', weights: [400], previewStack: '"Titan One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Titan One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Exo', label: 'Exo', category: 'sans-serif', googleId: 'Exo', weights: [300, 400, 500, 600, 700], previewStack: '"Exo", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Exo", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Rowdies', label: 'Rowdies', category: 'display', googleId: 'Rowdies', weights: [300, 400, 700], previewStack: '"Rowdies", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Rowdies", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Noto Sans HK', label: 'Noto Sans Hong Kong', category: 'sans-serif', googleId: 'Noto Sans HK', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Sans Hong Kong", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Sans Hong Kong", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Signika Negative', label: 'Signika Negative', category: 'sans-serif', googleId: 'Signika Negative', weights: [300, 400, 500, 600, 700], previewStack: '"Signika Negative", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Signika Negative", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans Arabic', category: 'sans-serif', googleId: 'IBM Plex Sans Arabic', weights: [300, 400, 500, 600, 700], previewStack: '"IBM Plex Sans Arabic", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"IBM Plex Sans Arabic", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Bodoni Moda', label: 'Bodoni Moda', category: 'serif', googleId: 'Bodoni Moda', weights: [400, 500, 600, 700], previewStack: '"Bodoni Moda", Georgia, Cambria, "Times New Roman", serif', stack: '"Bodoni Moda", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Righteous', label: 'Righteous', category: 'display', googleId: 'Righteous', weights: [400], previewStack: '"Righteous", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Righteous", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Archivo Narrow', label: 'Archivo Narrow', category: 'sans-serif', googleId: 'Archivo Narrow', weights: [400, 500, 600, 700], previewStack: '"Archivo Narrow", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Archivo Narrow", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Dela Gothic One', label: 'Dela Gothic One', category: 'display', googleId: 'Dela Gothic One', weights: [400], previewStack: '"Dela Gothic One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Dela Gothic One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Bree Serif', label: 'Bree Serif', category: 'serif', googleId: 'Bree Serif', weights: [400], previewStack: '"Bree Serif", Georgia, Cambria, "Times New Roman", serif', stack: '"Bree Serif", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Marcellus', label: 'Marcellus', category: 'serif', googleId: 'Marcellus', weights: [400], previewStack: '"Marcellus", Georgia, Cambria, "Times New Roman", serif', stack: '"Marcellus", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Signika', label: 'Signika', category: 'sans-serif', googleId: 'Signika', weights: [300, 400, 500, 600, 700], previewStack: '"Signika", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Signika", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Noto Sans Display', label: 'Noto Sans Display', category: 'sans-serif', googleId: 'Noto Sans Display', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Sans Display", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Sans Display", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Saira Condensed', label: 'Saira Condensed', category: 'sans-serif', googleId: 'Saira Condensed', weights: [300, 400, 500, 600, 700], previewStack: '"Saira Condensed", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Saira Condensed", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Cormorant', label: 'Cormorant', category: 'serif', googleId: 'Cormorant', weights: [300, 400, 500, 600, 700], previewStack: '"Cormorant", Georgia, Cambria, "Times New Roman", serif', stack: '"Cormorant", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Albert Sans', label: 'Albert Sans', category: 'sans-serif', googleId: 'Albert Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Albert Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Albert Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Vollkorn', label: 'Vollkorn', category: 'serif', googleId: 'Vollkorn', weights: [400, 500, 600, 700], previewStack: '"Vollkorn", Georgia, Cambria, "Times New Roman", serif', stack: '"Vollkorn", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'ABeeZee', label: 'ABeeZee', category: 'sans-serif', googleId: 'ABeeZee', weights: [400], previewStack: '"ABeeZee", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"ABeeZee", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Catamaran', label: 'Catamaran', category: 'sans-serif', googleId: 'Catamaran', weights: [300, 400, 500, 600, 700], previewStack: '"Catamaran", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Catamaran", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Rubik Mono One', label: 'Rubik Mono One', category: 'sans-serif', googleId: 'Rubik Mono One', weights: [400], previewStack: '"Rubik Mono One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Rubik Mono One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Oleo Script', label: 'Oleo Script', category: 'display', googleId: 'Oleo Script', weights: [400, 700], previewStack: '"Oleo Script", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Oleo Script", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Sanchez', label: 'Sanchez', category: 'serif', googleId: 'Sanchez', weights: [400], previewStack: '"Sanchez", Georgia, Cambria, "Times New Roman", serif', stack: '"Sanchez", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Sarabun', label: 'Sarabun', category: 'sans-serif', googleId: 'Sarabun', weights: [300, 400, 500, 600, 700], previewStack: '"Sarabun", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Sarabun", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Unbounded', label: 'Unbounded', category: 'sans-serif', googleId: 'Unbounded', weights: [300, 400, 500, 600, 700], previewStack: '"Unbounded", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Unbounded", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Hind Madurai', label: 'Hind Madurai', category: 'sans-serif', googleId: 'Hind Madurai', weights: [300, 400, 500, 600, 700], previewStack: '"Hind Madurai", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Hind Madurai", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Noto Kufi Arabic', label: 'Noto Kufi Arabic', category: 'sans-serif', googleId: 'Noto Kufi Arabic', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Kufi Arabic", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Noto Kufi Arabic", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Frank Ruhl Libre', label: 'Frank Ruhl Libre', category: 'serif', googleId: 'Frank Ruhl Libre', weights: [300, 400, 500, 600, 700], previewStack: '"Frank Ruhl Libre", Georgia, Cambria, "Times New Roman", serif', stack: '"Frank Ruhl Libre", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Spectral', label: 'Spectral', category: 'serif', googleId: 'Spectral', weights: [300, 400, 500, 600, 700], previewStack: '"Spectral", Georgia, Cambria, "Times New Roman", serif', stack: '"Spectral", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Noto Serif KR', label: 'Noto Serif Korean', category: 'serif', googleId: 'Noto Serif KR', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Serif Korean", Georgia, Cambria, "Times New Roman", serif', stack: '"Noto Serif Korean", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Fredoka', label: 'Fredoka', category: 'sans-serif', googleId: 'Fredoka', weights: [300, 400, 500, 600, 700], previewStack: '"Fredoka", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Fredoka", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'League Spartan', label: 'League Spartan', category: 'sans-serif', googleId: 'League Spartan', weights: [300, 400, 500, 600, 700], previewStack: '"League Spartan", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"League Spartan", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Montserrat Alternates', label: 'Montserrat Alternates', category: 'sans-serif', googleId: 'Montserrat Alternates', weights: [300, 400, 500, 600, 700], previewStack: '"Montserrat Alternates", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Montserrat Alternates", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Kalam', label: 'Kalam', category: 'handwriting', googleId: 'Kalam', weights: [300, 400, 700], previewStack: '"Kalam", "Comic Sans MS", "Segoe Script", cursive', stack: '"Kalam", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Amatic SC', label: 'Amatic SC', category: 'handwriting', googleId: 'Amatic SC', weights: [400, 700], previewStack: '"Amatic SC", "Comic Sans MS", "Segoe Script", cursive', stack: '"Amatic SC", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Alegreya Sans', label: 'Alegreya Sans', category: 'sans-serif', googleId: 'Alegreya Sans', weights: [300, 400, 500, 700], previewStack: '"Alegreya Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Alegreya Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Great Vibes', label: 'Great Vibes', category: 'handwriting', googleId: 'Great Vibes', weights: [400], previewStack: '"Great Vibes", "Comic Sans MS", "Segoe Script", cursive', stack: '"Great Vibes", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Alegreya', label: 'Alegreya', category: 'serif', googleId: 'Alegreya', weights: [400, 500, 600, 700], previewStack: '"Alegreya", Georgia, Cambria, "Times New Roman", serif', stack: '"Alegreya", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Instrument Sans', label: 'Instrument Sans', category: 'sans-serif', googleId: 'Instrument Sans', weights: [400, 500, 600, 700], previewStack: '"Instrument Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Instrument Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Yellowtail', label: 'Yellowtail', category: 'handwriting', googleId: 'Yellowtail', weights: [400], previewStack: '"Yellowtail", "Comic Sans MS", "Segoe Script", cursive', stack: '"Yellowtail", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Acme', label: 'Acme', category: 'sans-serif', googleId: 'Acme', weights: [400], previewStack: '"Acme", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Acme", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'IBM Plex Sans JP', label: 'IBM Plex Sans JP', category: 'sans-serif', googleId: 'IBM Plex Sans JP', weights: [300, 400, 500, 600, 700], previewStack: '"IBM Plex Sans JP", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"IBM Plex Sans JP", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Encode Sans', label: 'Encode Sans', category: 'sans-serif', googleId: 'Encode Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Encode Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Encode Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Antic Slab', label: 'Antic Slab', category: 'serif', googleId: 'Antic Slab', weights: [400], previewStack: '"Antic Slab", Georgia, Cambria, "Times New Roman", serif', stack: '"Antic Slab", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Noto Serif TC', label: 'Noto Serif Traditional Chinese', category: 'serif', googleId: 'Noto Serif TC', weights: [300, 400, 500, 600, 700], previewStack: '"Noto Serif Traditional Chinese", Georgia, Cambria, "Times New Roman", serif', stack: '"Noto Serif Traditional Chinese", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Creepster', label: 'Creepster', category: 'display', googleId: 'Creepster', weights: [400], previewStack: '"Creepster", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Creepster", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Geologica', label: 'Geologica', category: 'sans-serif', googleId: 'Geologica', weights: [300, 400, 500, 600, 700], previewStack: '"Geologica", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Geologica", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Sofia Sans', label: 'Sofia Sans', category: 'sans-serif', googleId: 'Sofia Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Sofia Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Sofia Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Newsreader', label: 'Newsreader', category: 'serif', googleId: 'Newsreader', weights: [300, 400, 500, 600, 700], previewStack: '"Newsreader", Georgia, Cambria, "Times New Roman", serif', stack: '"Newsreader", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Paytone One', label: 'Paytone One', category: 'sans-serif', googleId: 'Paytone One', weights: [400], previewStack: '"Paytone One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Paytone One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Tinos', label: 'Tinos', category: 'serif', googleId: 'Tinos', weights: [400, 700], previewStack: '"Tinos", Georgia, Cambria, "Times New Roman", serif', stack: '"Tinos", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Bangers', label: 'Bangers', category: 'display', googleId: 'Bangers', weights: [400], previewStack: '"Bangers", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Bangers", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'DM Mono', label: 'DM Mono', category: 'monospace', googleId: 'DM Mono', weights: [300, 400, 500], previewStack: '"DM Mono", "Roboto Mono", "Courier New", monospace', stack: '"DM Mono", "Roboto Mono", "Courier New", monospace' },
  { value: 'Changa', label: 'Changa', category: 'sans-serif', googleId: 'Changa', weights: [300, 400, 500, 600, 700], previewStack: '"Changa", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Changa", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Space Mono', label: 'Space Mono', category: 'monospace', googleId: 'Space Mono', weights: [400, 700], previewStack: '"Space Mono", "Roboto Mono", "Courier New", monospace', stack: '"Space Mono", "Roboto Mono", "Courier New", monospace' },
  { value: 'Russo One', label: 'Russo One', category: 'sans-serif', googleId: 'Russo One', weights: [400], previewStack: '"Russo One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Russo One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Cardo', label: 'Cardo', category: 'serif', googleId: 'Cardo', weights: [400, 700], previewStack: '"Cardo", Georgia, Cambria, "Times New Roman", serif', stack: '"Cardo", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Yanone Kaffeesatz', label: 'Yanone Kaffeesatz', category: 'sans-serif', googleId: 'Yanone Kaffeesatz', weights: [300, 400, 500, 600, 700], previewStack: '"Yanone Kaffeesatz", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Yanone Kaffeesatz", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Amiri', label: 'Amiri', category: 'serif', googleId: 'Amiri', weights: [400, 700], previewStack: '"Amiri", Georgia, Cambria, "Times New Roman", serif', stack: '"Amiri", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Advent Pro', label: 'Advent Pro', category: 'sans-serif', googleId: 'Advent Pro', weights: [300, 400, 500, 600, 700], previewStack: '"Advent Pro", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Advent Pro", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Cantarell', label: 'Cantarell', category: 'sans-serif', googleId: 'Cantarell', weights: [400, 700], previewStack: '"Cantarell", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Cantarell", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Gothic A1', label: 'Gothic A1', category: 'sans-serif', googleId: 'Gothic A1', weights: [300, 400, 500, 600, 700], previewStack: '"Gothic A1", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Gothic A1", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Press Start 2P', label: 'Press Start 2P', category: 'display', googleId: 'Press Start 2P', weights: [400], previewStack: '"Press Start 2P", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Press Start 2P", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Delius', label: 'Delius', category: 'handwriting', googleId: 'Delius', weights: [400], previewStack: '"Delius", "Comic Sans MS", "Segoe Script", cursive', stack: '"Delius", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Roboto Serif', label: 'Roboto Serif', category: 'serif', googleId: 'Roboto Serif', weights: [300, 400, 500, 600, 700], previewStack: '"Roboto Serif", Georgia, Cambria, "Times New Roman", serif', stack: '"Roboto Serif", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Chivo', label: 'Chivo', category: 'sans-serif', googleId: 'Chivo', weights: [300, 400, 500, 600, 700], previewStack: '"Chivo", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Chivo", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Zen Maru Gothic', label: 'Zen Maru Gothic', category: 'sans-serif', googleId: 'Zen Maru Gothic', weights: [300, 400, 500, 700], previewStack: '"Zen Maru Gothic", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Zen Maru Gothic", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Prata', label: 'Prata', category: 'serif', googleId: 'Prata', weights: [400], previewStack: '"Prata", Georgia, Cambria, "Times New Roman", serif', stack: '"Prata", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Red Hat Text', label: 'Red Hat Text', category: 'sans-serif', googleId: 'Red Hat Text', weights: [300, 400, 500, 600, 700], previewStack: '"Red Hat Text", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Red Hat Text", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Sawarabi Mincho', label: 'Sawarabi Mincho', category: 'serif', googleId: 'Sawarabi Mincho', weights: [400], previewStack: '"Sawarabi Mincho", Georgia, Cambria, "Times New Roman", serif', stack: '"Sawarabi Mincho", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Andada Pro', label: 'Andada Pro', category: 'serif', googleId: 'Andada Pro', weights: [400, 500, 600, 700], previewStack: '"Andada Pro", Georgia, Cambria, "Times New Roman", serif', stack: '"Andada Pro", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Courgette', label: 'Courgette', category: 'handwriting', googleId: 'Courgette', weights: [400], previewStack: '"Courgette", "Comic Sans MS", "Segoe Script", cursive', stack: '"Courgette", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono', category: 'monospace', googleId: 'JetBrains Mono', weights: [300, 400, 500, 600, 700], previewStack: '"JetBrains Mono", "Roboto Mono", "Courier New", monospace', stack: '"JetBrains Mono", "Roboto Mono", "Courier New", monospace' },
  { value: 'Comic Neue', label: 'Comic Neue', category: 'handwriting', googleId: 'Comic Neue', weights: [300, 400, 700], previewStack: '"Comic Neue", "Comic Sans MS", "Segoe Script", cursive', stack: '"Comic Neue", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Fugaz One', label: 'Fugaz One', category: 'display', googleId: 'Fugaz One', weights: [400], previewStack: '"Fugaz One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Fugaz One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Patua One', label: 'Patua One', category: 'display', googleId: 'Patua One', weights: [400], previewStack: '"Patua One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Patua One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Noticia Text', label: 'Noticia Text', category: 'serif', googleId: 'Noticia Text', weights: [400, 700], previewStack: '"Noticia Text", Georgia, Cambria, "Times New Roman", serif', stack: '"Noticia Text", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Eczar', label: 'Eczar', category: 'serif', googleId: 'Eczar', weights: [400, 500, 600, 700], previewStack: '"Eczar", Georgia, Cambria, "Times New Roman", serif', stack: '"Eczar", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Fraunces', label: 'Fraunces', category: 'serif', googleId: 'Fraunces', weights: [300, 400, 500, 600, 700], previewStack: '"Fraunces", Georgia, Cambria, "Times New Roman", serif', stack: '"Fraunces", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'DM Serif Text', label: 'DM Serif Text', category: 'serif', googleId: 'DM Serif Text', weights: [400], previewStack: '"DM Serif Text", Georgia, Cambria, "Times New Roman", serif', stack: '"DM Serif Text", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Kumbh Sans', label: 'Kumbh Sans', category: 'sans-serif', googleId: 'Kumbh Sans', weights: [300, 400, 500, 600, 700], previewStack: '"Kumbh Sans", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Kumbh Sans", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'News Cycle', label: 'News Cycle', category: 'sans-serif', googleId: 'News Cycle', weights: [400, 700], previewStack: '"News Cycle", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"News Cycle", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Alata', label: 'Alata', category: 'sans-serif', googleId: 'Alata', weights: [400], previewStack: '"Alata", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Alata", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Sawarabi Gothic', label: 'Sawarabi Gothic', category: 'sans-serif', googleId: 'Sawarabi Gothic', weights: [400], previewStack: '"Sawarabi Gothic", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Sawarabi Gothic", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Courier Prime', label: 'Courier Prime', category: 'monospace', googleId: 'Courier Prime', weights: [400, 700], previewStack: '"Courier Prime", "Roboto Mono", "Courier New", monospace', stack: '"Courier Prime", "Roboto Mono", "Courier New", monospace' },
  { value: 'PT Sans Caption', label: 'PT Sans Caption', category: 'sans-serif', googleId: 'PT Sans Caption', weights: [400, 700], previewStack: '"PT Sans Caption", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"PT Sans Caption", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Passion One', label: 'Passion One', category: 'display', googleId: 'Passion One', weights: [400, 700], previewStack: '"Passion One", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Passion One", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Kaushan Script', label: 'Kaushan Script', category: 'handwriting', googleId: 'Kaushan Script', weights: [400], previewStack: '"Kaushan Script", "Comic Sans MS", "Segoe Script", cursive', stack: '"Kaushan Script", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Shippori Mincho', label: 'Shippori Mincho', category: 'serif', googleId: 'Shippori Mincho', weights: [400, 500, 600, 700], previewStack: '"Shippori Mincho", Georgia, Cambria, "Times New Roman", serif', stack: '"Shippori Mincho", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Crimson Pro', label: 'Crimson Pro', category: 'serif', googleId: 'Crimson Pro', weights: [300, 400, 500, 600, 700], previewStack: '"Crimson Pro", Georgia, Cambria, "Times New Roman", serif', stack: '"Crimson Pro", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Didact Gothic', label: 'Didact Gothic', category: 'sans-serif', googleId: 'Didact Gothic', weights: [400], previewStack: '"Didact Gothic", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Didact Gothic", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Atkinson Hyperlegible', label: 'Atkinson Hyperlegible', category: 'sans-serif', googleId: 'Atkinson Hyperlegible', weights: [400, 700], previewStack: '"Atkinson Hyperlegible", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Atkinson Hyperlegible", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Readex Pro', label: 'Readex Pro', category: 'sans-serif', googleId: 'Readex Pro', weights: [300, 400, 500, 600, 700], previewStack: '"Readex Pro", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Readex Pro", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Crete Round', label: 'Crete Round', category: 'serif', googleId: 'Crete Round', weights: [400], previewStack: '"Crete Round", Georgia, Cambria, "Times New Roman", serif', stack: '"Crete Round", Georgia, Cambria, "Times New Roman", serif' },
  { value: 'Blinker', label: 'Blinker', category: 'sans-serif', googleId: 'Blinker', weights: [300, 400, 600, 700], previewStack: '"Blinker", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Blinker", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Encode Sans Condensed', label: 'Encode Sans Condensed', category: 'sans-serif', googleId: 'Encode Sans Condensed', weights: [300, 400, 500, 600, 700], previewStack: '"Encode Sans Condensed", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Encode Sans Condensed", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Gloria Hallelujah', label: 'Gloria Hallelujah', category: 'handwriting', googleId: 'Gloria Hallelujah', weights: [400], previewStack: '"Gloria Hallelujah", "Comic Sans MS", "Segoe Script", cursive', stack: '"Gloria Hallelujah", "Comic Sans MS", "Segoe Script", cursive' },
  { value: 'Hanken Grotesk', label: 'Hanken Grotesk', category: 'sans-serif', googleId: 'Hanken Grotesk', weights: [300, 400, 500, 600, 700], previewStack: '"Hanken Grotesk", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Hanken Grotesk", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Viga', label: 'Viga', category: 'sans-serif', googleId: 'Viga', weights: [400], previewStack: '"Viga", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Viga", "Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: 'Onest', label: 'Onest', category: 'sans-serif', googleId: 'Onest', weights: [300, 400, 500, 600, 700], previewStack: '"Onest", "Inter", "Helvetica Neue", Arial, sans-serif', stack: '"Onest", "Inter", "Helvetica Neue", Arial, sans-serif' }
];

const LEGACY_FONT_OPTIONS: FontFamilySelectOption[] = [
  {
    value: 'sans',
    label: 'Legacy Sans Serif',
    category: 'sans-serif',
    googleId: undefined,
    weights: [400, 500, 600, 700],
    previewStack: DEFAULT_SANS_STACK,
    stack: DEFAULT_SANS_STACK,
    legacy: true,
  },
  {
    value: 'serif',
    label: 'Legacy Serif',
    category: 'serif',
    googleId: undefined,
    weights: [400, 700],
    previewStack: DEFAULT_SERIF_STACK,
    stack: DEFAULT_SERIF_STACK,
    legacy: true,
  },
  {
    value: 'mono',
    label: 'Legacy Monospace',
    category: 'monospace',
    googleId: undefined,
    weights: [400, 500, 600, 700],
    previewStack: DEFAULT_MONO_STACK,
    stack: DEFAULT_MONO_STACK,
    legacy: true,
  },
];

export const FONT_FAMILY_SELECT_OPTIONS: FontFamilySelectOption[] = [
  {
    value: 'default',
    label: 'Theme default (Inter)',
    category: 'sans-serif',
    googleId: undefined,
    weights: [300, 400, 500, 600, 700],
    previewStack: DEFAULT_SANS_STACK,
    stack: undefined,
  },
  ...GOOGLE_FONT_SELECT_OPTIONS,
  ...LEGACY_FONT_OPTIONS,
];

const normalizeFontKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const FONT_FAMILY_LOOKUP: Record<string, SlideBlockFontFamily> = {};

const registerFontLookup = (key: string | undefined | null, value: SlideBlockFontFamily) => {
  if (!key) return;
  const normalized = normalizeFontKey(key);
  if (!normalized) return;
  FONT_FAMILY_LOOKUP[normalized] = value;
};

registerFontLookup('default', 'default');
registerFontLookup('inherit', 'default');
registerFontLookup('defaultinherit', 'default');
registerFontLookup('sans', 'sans');
registerFontLookup('sansserif', 'sans');
registerFontLookup('legacysansserif', 'sans');
registerFontLookup('serif', 'serif');
registerFontLookup('legacyserif', 'serif');
registerFontLookup('mono', 'mono');
registerFontLookup('monospace', 'mono');
registerFontLookup('legacymonospace', 'mono');

FONT_FAMILY_SELECT_OPTIONS.forEach((option) => {
  registerFontLookup(option.value, option.value);
  registerFontLookup(option.label, option.value);
  if (option.googleId) {
    registerFontLookup(option.googleId, option.value);
  }
});

export function normalizeFontFamily(value: unknown): SlideBlockFontFamily | undefined {
  if (typeof value !== 'string') return undefined;
  const normalizedKey = normalizeFontKey(value);
  if (!normalizedKey) return undefined;
  return FONT_FAMILY_LOOKUP[normalizedKey];
}

const FONT_OPTION_MAP: Record<SlideBlockFontFamily, FontFamilySelectOption> = {};
FONT_FAMILY_SELECT_OPTIONS.forEach((option) => {
  FONT_OPTION_MAP[option.value] = option;
});

const FONT_STACK_MAP: Record<SlideBlockFontFamily, string | undefined> = {
  default: undefined,
  sans: DEFAULT_SANS_STACK,
  serif: DEFAULT_SERIF_STACK,
  mono: DEFAULT_MONO_STACK,
};

FONT_FAMILY_SELECT_OPTIONS.forEach((option) => {
  if (option.stack !== undefined) {
    FONT_STACK_MAP[option.value] = option.stack;
  } else if (!(option.value in FONT_STACK_MAP)) {
    if (option.category === 'serif') {
      FONT_STACK_MAP[option.value] = DEFAULT_SERIF_STACK;
    } else if (option.category === 'monospace') {
      FONT_STACK_MAP[option.value] = DEFAULT_MONO_STACK;
    } else if (option.category === 'handwriting') {
      FONT_STACK_MAP[option.value] = DEFAULT_HANDWRITING_STACK;
    } else {
      FONT_STACK_MAP[option.value] = DEFAULT_SANS_STACK;
    }
  }
});

export const getFontOption = (
  value: SlideBlockFontFamily,
): FontFamilySelectOption | undefined => FONT_OPTION_MAP[value];

export const getFontStackForFamily = (
  value: SlideBlockFontFamily,
): string | undefined => FONT_STACK_MAP[value];

const GOOGLE_FONT_REGISTRY: Record<SlideBlockFontFamily, { googleId: string; weights: number[] }> = {};
FONT_FAMILY_SELECT_OPTIONS.forEach((option) => {
  if (option.googleId) {
    GOOGLE_FONT_REGISTRY[option.value] = {
      googleId: option.googleId,
      weights: option.weights.length > 0 ? option.weights : [400],
    };
  }
});

const LOADED_GOOGLE_FONTS = new Set<string>();

const ensureGoogleFontLoaded = (family: SlideBlockFontFamily) => {
  const record = GOOGLE_FONT_REGISTRY[family];
  if (!record) return;
  const weights = Array.from(new Set(record.weights)).sort((a, b) => a - b);
  const key = `${record.googleId}:${weights.join(',')}`;
  if (LOADED_GOOGLE_FONTS.has(key)) return;
  if (typeof window === 'undefined') return;
  if (document.querySelector(`link[data-of-font="${key}"]`)) {
    LOADED_GOOGLE_FONTS.add(key);
    return;
  }
  const familyParam = encodeURIComponent(record.googleId).replace(/%20/g, '+');
  const weightSegment = weights.length > 0 ? `:wght@${weights.join(';')}` : '';
  const href = `https://fonts.googleapis.com/css2?family=${familyParam}${weightSegment}&display=swap`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-of-font', key);
  document.head.appendChild(link);
  LOADED_GOOGLE_FONTS.add(key);
};

export type FontConfigurableBlock = {
  fontFamily?: SlideBlockFontFamily | string | null;
  config?: unknown;
};

export const resolveBlockFontFamily = (
  block: FontConfigurableBlock | undefined | null,
): SlideBlockFontFamily => {
  if (!block) return DEFAULT_TEXT_FONT_FAMILY;
  const normalizedFromBlock = normalizeFontFamily(block.fontFamily);
  if (normalizedFromBlock) return normalizedFromBlock;
  const configSource =
    block.config && typeof block.config === 'object'
      ? normalizeFontFamily((block.config as Record<string, any>).fontFamily)
      : undefined;
  return configSource ?? DEFAULT_TEXT_FONT_FAMILY;
};

export const resolveFontStackForBlock = (
  block: FontConfigurableBlock | undefined | null,
): string | undefined => {
  const family = resolveBlockFontFamily(block);
  return getFontStackForFamily(family);
};

export const useGoogleFontLoader = (
  families: Array<SlideBlockFontFamily | string | null | undefined>,
) => {
  const normalizedFamilies = useMemo(() => {
    const set = new Set<SlideBlockFontFamily>();
    families.forEach((family) => {
      if (!family) return;
      const normalized = normalizeFontFamily(family);
      if (normalized === 'default') {
        set.add(DEFAULT_TEXT_FONT_FAMILY);
        return;
      }
      if (normalized) {
        set.add(normalized);
        return;
      }
      if (typeof family === 'string') {
        const fallback = normalizeFontFamily(DEFAULT_TEXT_FONT_FAMILY);
        if (fallback) {
          set.add(fallback);
        } else {
          set.add(DEFAULT_TEXT_FONT_FAMILY);
        }
      }
    });
    if (set.size === 0) {
      set.add(DEFAULT_TEXT_FONT_FAMILY);
    }
    return Array.from(set).sort();
  }, [families]);

  const familyKey = normalizedFamilies.join('|');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    normalizedFamilies.forEach((family) => {
      ensureGoogleFontLoaded(family);
    });
  }, [familyKey, normalizedFamilies]);
};

