<script>
    // Copy and paste this into your svelte program or svelte playground
    // Alternative to using runes, or use them with runes and with the svelte store

    import { createNode } from "dagify";

    // Create a stateful node called "count" with an initial value of 0.
    const count = createNode(0);

    // Create a computed node "doubleCount" that depends on "count"
    // and calculates its value as count * 2.
    const doubleCount = createNode(
        ([current]) => current * 2,
        [count]
    );

    const biggerThan10 = createNode(
        ([current]) => current > 10,
        [doubleCount]
    );

    // Function to increment the count.
    function increment() {
        // Update the state by setting the new value.
        // (Dagify nodes act like Svelte stores, so we can use the $ prefix to access their value.)
        count.set($count + 1);
    }
</script>

{#snippet tooBig(value)}
    <p style="color: red">{value}</p>
{/snippet}

<main>
    <h1>Dagify and Svelte Example</h1>
    <p>Count: {$count}</p>
    <p>Double Count: {$doubleCount}</p>
    <button onclick={increment}>Increment</button>
    {@render $biggerThan10 ? tooBig("Huge number, really.") : undefined}
</main>

<style>
    main {
        font-family: sans-serif;
        max-width: 400px;
        margin: 0 auto;
        text-align: center;
        padding: 1rem;
    }
    button {
        padding: 0.5rem 1rem;
        font-size: 1rem;
        margin-top: 1rem;
        cursor: pointer;
    }
</style>
