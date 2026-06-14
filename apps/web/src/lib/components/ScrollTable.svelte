<script lang="ts">
  let { columns, rows }: { columns: string[]; rows: string[][] } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (focusable so keyboard users can scroll the table) -->
<div class="scroll" role="region" aria-label="Таблица" tabindex="0">
  <table>
    <thead>
      <tr>
        {#each columns as c, i (i)}<th>{c}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, ri (ri)}
        <tr>
          {#each row as cell, ci (ci)}<td>{cell}</td>{/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .scroll {
    overflow-x: auto;
    max-width: 100%;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  table {
    border-collapse: collapse;
    min-width: 100%;
    font-size: 0.9em;
  }
  th,
  td {
    border: 1px solid var(--border);
    padding: 0.35rem 0.6rem;
    text-align: left;
    white-space: nowrap;
    vertical-align: top;
  }
  th {
    background: var(--bg-soft);
    position: sticky;
    top: 0;
  }
</style>
