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
    border-radius: calc(var(--radius) + 6px);
    background: var(--card);
    box-shadow: var(--shadow-sm);
  }
  table {
    border-collapse: separate;
    border-spacing: 0;
    min-width: 100%;
    font-size: 0.9em;
  }
  th,
  td {
    border-bottom: 1px solid var(--border);
    padding: 0.55rem 0.7rem;
    text-align: left;
    white-space: nowrap;
    vertical-align: top;
  }
  th {
    background: var(--surface);
    position: sticky;
    top: 0;
    color: var(--fg-secondary);
    font-size: var(--fs-caption);
    font-weight: var(--fw-semibold);
  }
  tr:last-child td {
    border-bottom: none;
  }
</style>
