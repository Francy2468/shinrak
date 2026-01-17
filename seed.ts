import { storage } from "./storage";
import { products } from "@shared/schema";
import { db } from "./db";

export async function seed() {
  const existingProducts = await storage.getProducts();
  if (existingProducts.length === 0) {
    console.log("Seeding database...");
    
    // Create Default Product
    const product = await storage.createProduct({
        name: "Shinra OS",
        description: "Premium Script Hub - Level 8 Executor Compatible",
        version: "2.4.1",
        isEnabled: true
    });

    // Create Initial Script
    await storage.upsertScript({
        productId: product.id,
        content: `print("Hello from Shinra OS!")\nwarn("Loaded successfully.")`,
        isObfuscated: false
    });

    // Create a Test License
    await storage.createLicense({
        key: "SHINRA-TEST-KEY-12345",
        productId: product.id,
        status: "active",
        createdBy: "system"
    });

    console.log("Seeding complete!");
  }
}
