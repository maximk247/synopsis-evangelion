<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
</script>

<svelte:head><title>Источник</title></svelte:head>

<Breadcrumbs parent={{ label: 'Материалы', path: '/materials' }} />

<h1>Источник</h1>

<div class="prose">
  <p>
    Издание «Евангельский синопсис» (сост. свящ. А. Емельянов) с полным текстом
    примечаний опубликовано на «Азбуке веры»:
  </p>
  <p>
    <a href="https://azbyka.ru/otechnik/Biblia/evangelskij-sinopsis/" target="_blank" rel="noopener"
      >azbyka.ru/otechnik/Biblia/evangelskij-sinopsis</a
    >
  </p>
</div>

<style>
  .prose {
    font-family: var(--reading-font);
    padding: clamp(1rem, 3vw, 1.5rem);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) + 8px);
    background: color-mix(in srgb, var(--card) 76%, transparent);
    box-shadow: var(--shadow-sm);
  }
  .prose p {
    margin: 0;
  }
  .prose p + p {
    margin-top: 0.75rem;
  }
</style>
