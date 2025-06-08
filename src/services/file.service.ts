import * as XLSX from 'xlsx';
import fs from 'fs';

export interface Customer {
  name: string;
  productDescription: string;
  [key: string]: any; // Allow additional fields
}

export async function processFile(filePath: string): Promise<Customer[]> {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    // Validate and transform data
    const customers: Customer[] = data.map((row: any) => {
      // Check for required columns with their exact names
      if (!row['Customer Name'] || !row['Product Description']) {
        throw new Error('File must contain "Customer Name" and "Product Description" columns');
      }

      return {
        name: String(row['Customer Name']).trim(),
        productDescription: String(row['Product Description']).trim(),
        ...row // Include any additional fields if present
      };
    });

    return customers;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error processing file: ${error.message}`);
    }
    throw error;
  }
} 