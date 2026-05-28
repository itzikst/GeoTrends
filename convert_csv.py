import csv
import os

def convert_csv(input_path, output_path):
    # Mapping periods to (start_year, end_year)
    periods = {
        "Neolith": (-10000, -5800),
        "Chalcolithic": (-5800, -3600),
        "Eearly Bronze": (-3600, -2000),
        "Early Bronze": (-3600, -2000),
        "Middle Bronze": (-2000, -1500),
        "Late Bronze": (-1500, -1200),
        "Early Iron": (-1200, -1000),
        "Late Iron": (-1000, -586),
        "Helenistic": (-586, -37),
        "Roman": (-37, 324),
        "Byzantine": (324, 638),
        "Early Muslim": (638, 1099),
        "Crusaders": (1099, 1517),
        "Ottoman": (1517, 1917),
        "Modern": (1917, 2026)
    }

    # Expected column order in output CSV
    output_headers = [
        "location name",
        "latitude",
        "longitude",
        "start year",
        "end time",
        "title",
        "description"
    ]

    print(f"Reading from: {input_path}")
    if not os.path.exists(input_path):
        print(f"Error: Input file {input_path} does not exist.")
        return

    rows_emitted = 0
    with open(input_path, mode='r', encoding='utf-8') as infile:
        # Use DictReader to easily access by column names
        reader = csv.DictReader(infile)
        
        # Strip whitespace from keys/headers in case there's any
        reader.fieldnames = [name.strip() for name in reader.fieldnames]
        
        with open(output_path, mode='w', newline='', encoding='utf-8') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=output_headers)
            writer.writeheader()
            
            for row in reader:
                entity = row.get("entity", "").strip()
                entityLabel = row.get("entityLabel", "").strip()
                lat = row.get("lat", "").strip()
                lng = row.get("lng", "").strip()
                type_val = row.get("type", "").strip()
                
                # Iterate through all possible periods
                for period, (start_yr, end_yr) in periods.items():
                    # Check if the column exists in the row
                    if period in row:
                        val = row[period].strip().upper()
                        if val == "TRUE":
                            writer.writerow({
                                "location name": entityLabel,
                                "latitude": lat,
                                "longitude": lng,
                                "start year": start_yr,
                                "end time": end_yr,
                                "title": type_val,
                                "description": entity
                            })
                            rows_emitted += 1
                            
    print(f"Conversion complete! Emitted {rows_emitted} rows to {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\itzik\.gemini\antigravity\scratch\GeoTrends\Timna Data.csv"
    output_file = r"C:\Users\itzik\.gemini\antigravity\scratch\GeoTrends\Timna_Converted.csv"
    convert_csv(input_file, output_file)
