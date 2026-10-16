import { useState, useEffect } from 'react';
import { getMediaDirectory, getMediaDirectorySync } from './mediaService';

/**
 * Hook único para obter o diretório local de mídia do app (com barra final),
 * garantindo sua existência assincronamente e fornecendo um valor síncrono padrão imediato.
 */
export function useMediaDirectory(): string {
  const [mediaDirectory, setMediaDirectory] = useState<string>(() => getMediaDirectorySync());

  useEffect(() => {
    let isMounted = true;
    getMediaDirectory().then((dir) => {
      if (isMounted && dir !== getMediaDirectorySync()) {
        setMediaDirectory(dir);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return mediaDirectory;
}
