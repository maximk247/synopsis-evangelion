<script lang="ts">
  import { base } from '$app/paths';
  let {
    sectionTitle,
    current
  }: {
    sectionTitle?: string | undefined;
    current: string;
  } = $props();
</script>

<nav class="crumbs" aria-label="Хлебные крошки">
  <a href="{base}/">Содержание</a>
  {#if sectionTitle}<span aria-hidden="true">›</span> <span>{sectionTitle}</span>{/if}
  <span aria-hidden="true">›</span> <b>{current}</b>
</nav>

<style>
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0.5rem 0 1rem;
  }
  .crumbs a {
    color: var(--fg-muted);
  }
</style>
