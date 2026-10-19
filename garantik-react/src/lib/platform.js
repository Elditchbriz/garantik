import { Capacitor } from '@capacitor/core';

// true UNIQUEMENT dans l'app Android installée depuis le Play Store.
// false sur le site, dans un navigateur, et en mode webapp (site installé sur l'écran d'accueil) : le site garde
// donc exactement son comportement habituel.
//
// Même détection que le reste de l'application (verrou biométrique, scanner, connexion Google) : elle fonctionne avec
// le montage actuel, où l'app Android charge le site en direct (server.url).
export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;   // en cas de doute, on se comporte comme le site
  }
}
