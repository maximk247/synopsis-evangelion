<script lang="ts">
  let scrollY = $state(0);
  const show = $derived(scrollY > 600);

  function toTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

<svelte:window bind:scrollY />

{#if show}
  <button class="totop totop--left" onclick={toTop} aria-label="Наверх"
    ><span class="totop__glyph">‹</span></button
  >
  <button class="totop totop--right" onclick={toTop} aria-label="Наверх"
    ><span class="totop__glyph">‹</span></button
  >
{/if}

<style>
  /* full-gutter "to top" zones, styled like the pericope side arrows */
  .totop {
    position: fixed;
    top: 4.5rem;
    bottom: 0;
    z-index: 5;
    display: grid;
    place-items: center;
    width: max(4rem, calc((100vw - var(--page-max)) / 2));
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--fg-muted);
    font-family: var(--font-serif);
    font-size: 3.2rem;
    line-height: 1;
    opacity: 0.4;
    cursor: pointer;
    transition:
      opacity 0.2s ease,
      color 0.2s ease,
      background 0.2s ease;
  }
  .totop__glyph {
    display: inline-block;
    transform: rotate(90deg);
  }
  .totop--left {
    left: 0;
  }
  .totop--right {
    right: 0;
  }
  .totop:hover,
  .totop:focus-visible {
    opacity: 1;
    color: var(--accent);
    backdrop-filter: blur(5px);
  }
  .totop--left:hover,
  .totop--left:focus-visible {
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--accent-soft) 75%, transparent),
      transparent
    );
  }
  .totop--right:hover,
  .totop--right:focus-visible {
    background: linear-gradient(
      to left,
      color-mix(in srgb, var(--accent-soft) 75%, transparent),
      transparent
    );
  }
  @media (max-width: 1299.98px) {
    .totop {
      display: none;
    }
  }
</style>
