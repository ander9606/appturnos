import { Nav } from './landing/sections/Nav';
import { Hero } from './landing/sections/Hero';
import { Stats } from './landing/sections/Stats';
import { Mockups } from './landing/sections/Mockups';
import { ParaTrabajadores } from './landing/sections/ParaTrabajadores';
import { Pain } from './landing/sections/Pain';
import { HowItWorks } from './landing/sections/HowItWorks';
import { ProductSplit } from './landing/sections/ProductSplit';
import { Sectors } from './landing/sections/Sectors';
import { FinalCta } from './landing/sections/FinalCta';
import { Footer } from './landing/sections/Footer';

/**
 * Landing pública de zaturno.app — vive fuera del área autenticada.
 * Reusa los tokens de marca reales de index.css (mismo naranja que la app
 * móvil y el panel) en vez de una paleta de marca provisional.
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Stats />
      <Mockups />
      <ParaTrabajadores />
      <Pain />
      <HowItWorks />
      <ProductSplit />
      <Sectors />
      <FinalCta />
      <Footer />
    </div>
  );
}
