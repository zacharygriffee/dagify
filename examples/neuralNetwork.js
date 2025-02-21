import { createNode, createGraph } from "../index.secure.js";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// --- Create Input Nodes ---
const input1 = createNode(0);
const input2 = createNode(0);

// --- Create Hidden Layer Neurons ---
// Each hidden neuron computes: sigmoid(input1 * w1 + input2 * w2)
const hiddenWeights = [
    [0.5, -0.3],   // weights for neuron 1
    [-0.2, 0.8],   // weights for neuron 2
    [0.1, 0.4]     // weights for neuron 3
];

const hiddenNeurons = hiddenWeights.map(weights => {
    return createNode(
        (inputs) => {
            // Compute weighted sum of inputs
            const sum = inputs[0] * weights[0] + inputs[1] * weights[1];
            // Apply sigmoid activation function
            return 1 / (1 + Math.exp(-sum));
        },
        [input1, input2]
    );
});

// --- Create Output Neuron ---
// The output neuron computes: sigmoid(sum(hidden_i * weight_i))
const outputWeights = [1.0, -1.0, 0.5];
const outputNeuron = createNode(
    (hiddenValues) => {
        const sum = hiddenValues.reduce((acc, val, i) => acc + val * outputWeights[i], 0);
        // Apply sigmoid activation
        return 1 / (1 + Math.exp(-sum));
    },
    hiddenNeurons
);

// --- Create and Populate the Graph ---
const graph = createGraph();
graph.addNodes([input1, input2, ...hiddenNeurons, outputNeuron]);


// --- Test the Network ---
// Updating input nodes will trigger recomputation in the network.
input1.set(1);
input2.set(0.5);
await sleep(0);
console.log(outputNeuron.value);
input1.set(-1);
input2.set(-0.5);
await sleep(0);
console.log(outputNeuron.value);