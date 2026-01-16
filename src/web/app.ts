import { NoCloudApp } from "./NoCloudApp";

/**
 * Screenshot capture application
 * Headless NUI for capturing in-game photos using WebGL (same as screenshot-basic)
 */
class App extends NoCloudApp {
  protected init(): void {
    // Application initialized - screenshot capture is handled automatically
    // when NUI receives a request.image message from the client
    console.log("NoCloud Screenshot NUI initialized");
  }
}

// Initialize the application when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new App();
});
