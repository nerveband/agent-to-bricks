import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAtomValue } from 'jotai';
import { activeSiteAtom } from '../atoms/app';

interface AbilityAnnotations {
  readonly: boolean;
  destructive: boolean;
  idempotent: boolean;
}

export interface AbilityInfo {
  name: string;
  label: string;
  description: string;
  category: string;
  annotations?: AbilityAnnotations;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

export function useAbilities() {
  const site = useAtomValue(activeSiteAtom);
  const [abilities, setAbilities] = useState<AbilityInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAbilities = useCallback(async () => {
    if (!site?.site_url || !site?.api_key) {
      setAbilities([]);
      return;
    }
    setLoading(true);
    try {
      const result = await invoke<AbilityInfo[]>('get_abilities', {
        siteUrl: site.site_url,
        apiKey: site.api_key,
      });
      setAbilities(result);
    } catch {
      setAbilities([]);
    } finally {
      setLoading(false);
    }
  }, [site?.site_url, site?.api_key]);

  useEffect(() => {
    fetchAbilities();
  }, [fetchAbilities]);

  const atbAbilities = abilities.filter(a => a.name.startsWith('agent-bricks/'));
  const thirdPartyAbilities = abilities.filter(a => !a.name.startsWith('agent-bricks/'));

  return {
    abilities,
    atbAbilities,
    thirdPartyAbilities,
    loading,
    hasAbilities: abilities.length > 0,
    refresh: fetchAbilities,
  };
}
