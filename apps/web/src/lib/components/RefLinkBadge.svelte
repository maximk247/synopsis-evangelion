<script lang="ts">
  import { base } from '$app/paths';
  import type { RefLink } from '@synopsis/schema';
  let { link, kind }: { link: RefLink; kind: 'prev' | 'next' } = $props();
  const label = $derived(kind === 'prev' ? 'ранее' : 'далее');
</script>

<a class="reflink" href="{base}/p/{link.p}" title="Перейти к перикопе {link.p}">
  {label}: {link.ref} <span class="pid">(п. {link.p})</span>
</a>

<style>
  .reflink {
    display: inline-block;
    font-size: 0.85em;
    color: var(--fg-muted);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    margin: 0.1rem 0.2rem 0.1rem 0;
  }
  .reflink:hover {
    color: var(--accent);
    text-decoration: none;
  }
  .pid {
    opacity: 0.7;
  }
</style>
