<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let {
    prevId,
    nextId
  }: {
    prevId?: string | undefined;
    nextId?: string | undefined;
  } = $props();

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && prevId) goto(`${base}/p/${prevId}`);
      if (e.key === 'ArrowRight' && nextId) goto(`${base}/p/${nextId}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="pager">
  {#if prevId}
    <a class="pbtn" href="{base}/p/{prevId}" aria-label="Предыдущая перикопа">‹ Пред.</a>
  {:else}
    <span class="pbtn disabled" aria-hidden="true">‹ Пред.</span>
  {/if}
  {#if nextId}
    <a class="pbtn" href="{base}/p/{nextId}" aria-label="Следующая перикопа">След. ›</a>
  {:else}
    <span class="pbtn disabled" aria-hidden="true">След. ›</span>
  {/if}
</div>

<style>
  .pager {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin: 1.5rem 0;
  }
  .pbtn {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.4rem 0.8rem;
  }
  .pbtn.disabled {
    color: var(--fg-muted);
    opacity: 0.4;
  }
</style>
