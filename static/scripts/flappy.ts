export default class FlappyBird {
    // Constants
    private gravity: number = 50; // How much gravity pulls the bird down
    private jumpVelocity: number = -150; // Initial velocity when the bird jumps

    // Variables
    public yPosition: number = 100; // Initial Y position of the bird (height)
    private velocity: number = 0; // Initial velocity (starts at 0)

    constructor(initialYPosition: number = 100) {
        this.yPosition = initialYPosition;
    }

    // Update function that is called every frame
    public update(dt: number): void {
        // Apply gravity to the velocity
        this.velocity += this.gravity * dt;

        // Update the position based on the velocity
        this.yPosition += this.velocity * dt;
    }

    // Make the bird jump (set upward velocity)
    public jump(): void {
        this.velocity = this.jumpVelocity;
    }

    // Get the current y position
    public getYPosition(): number {
        return this.yPosition;
    }
}