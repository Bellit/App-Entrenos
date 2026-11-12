import { routeHref } from '../app/useRoute';
import { Signature } from './Signature';

/** Pie de las páginas principales: la firma del autor y el enlace a la privacidad. */
export function PageFooter() {
  return (
    <footer className="page-foot">
      <Signature small />
      <a href={routeHref.privacy}>Privacidad</a>
    </footer>
  );
}
