<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  let value = $state('');
  function submit(e: Event) {
    e.preventDefault();
    const q = value.trim();
    if (q) goto(`${base}/search?q=${encodeURIComponent(q)}`);
  }
</script>

<form class="searchbox" onsubmit={submit} role="search">
  <input
    name="q"
    type="search"
    placeholder="Поиск: текст или «Мф 5:3»"
    bind:value
    aria-label="Поиск"
  />
</form>

<style>
  .searchbox {
    flex: 1;
    max-width: 360px;
  }
  .searchbox input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
  }
</style>
