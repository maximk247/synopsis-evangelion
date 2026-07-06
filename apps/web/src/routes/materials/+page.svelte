<script lang="ts">
  import { base } from '$app/paths';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

  const items = [
    {
      href: '/read/lk',
      title: 'Евангелия подряд',
      desc: 'Сплошной текст каждого Евангелия с отметками перикоп.'
    },
    {
      href: '/prefaces',
      title: 'Предисловия',
      desc: 'Вступительные статьи издания: что такое синопсис и как им пользоваться.'
    },
    {
      href: '/footnotes',
      title: 'Примечания',
      desc: 'Постраничные сноски и пояснения к тексту.'
    }
  ];
</script>

<svelte:head><title>Материалы</title></svelte:head>

<div class="page-top">
  <h1>Материалы</h1>
  <Breadcrumbs />
</div>

<ul class="cards">
  {#each items as it (it.href)}
    <li>
      <a class="card" href="{base}{it.href}">
        <strong>{it.title}</strong>
        <span>{it.desc}</span>
      </a>
    </li>
  {/each}
</ul>

<style>
  .page-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 0 0 1rem;
  }
  .page-top h1 {
    margin: 0;
  }
  .page-top :global(.crumbs) {
    margin: 0;
  }
  .cards {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.6rem;
  }
  .card {
    display: grid;
    gap: 0.25rem;
    padding: 0.9rem 1rem;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) + 4px);
    background: color-mix(in srgb, var(--card) 76%, transparent);
    color: var(--fg);
  }
  .card:hover {
    text-decoration: none;
    background: var(--hover);
    border-color: var(--border-strong);
  }
  .card strong {
    color: var(--accent);
    font-family: var(--font-serif);
    font-size: var(--fs-h3);
  }
  .card span {
    color: var(--fg-secondary);
    font-size: var(--fs-ui-sm);
  }
</style>
