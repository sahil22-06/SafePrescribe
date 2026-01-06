import sqlite3
import os

def check_medicinal_data():
    """Check if medicinal data exists in the database"""
    
    # Check if database exists
    if not os.path.exists('db.sqlite3'):
        print("[ERROR] Database file (db.sqlite3) does not exist!")
        return
    
    print("[SUCCESS] Database file exists")
    
    # Connect to database
    conn = sqlite3.connect('db.sqlite3')
    cursor = conn.cursor()
    
    try:
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        print(f"\n[INFO] Tables in database ({len(tables)} total):")
        for table in tables:
            print(f"  - {table[0]}")
        
        # Check drugs table specifically
        if any('drug' in table[0].lower() for table in tables):
            print(f"\n[DRUGS] Checking drugs table...")
            
            # Find drugs table
            drugs_table = None
            for table in tables:
                if 'drug' in table[0].lower():
                    drugs_table = table[0]
                    break
            
            if drugs_table:
                # Count drugs
                cursor.execute(f"SELECT COUNT(*) FROM {drugs_table}")
                drug_count = cursor.fetchone()[0]
                print(f"  [COUNT] Total drugs in database: {drug_count}")
                
                if drug_count > 0:
                    # Get sample drugs
                    cursor.execute(f"SELECT id, name, therapeutic_class FROM {drugs_table} LIMIT 5")
                    sample_drugs = cursor.fetchall()
                    
                    print(f"  [SAMPLE] Sample drugs:")
                    for drug in sample_drugs:
                        print(f"    - ID: {drug[0]}, Name: {drug[1]}, Class: {drug[2] or 'N/A'}")
                else:
                    print("  [WARNING] No drugs found in database!")
            else:
                print("  [ERROR] No drugs table found!")
        else:
            print("\n[ERROR] No drugs table found in database!")
        
        # Check allergies table
        if any('allerg' in table[0].lower() for table in tables):
            print(f"\n[ALLERGIES] Checking allergies table...")
            
            # Find allergies table
            allergies_table = None
            for table in tables:
                if 'allerg' in table[0].lower():
                    allergies_table = table[0]
                    break
            
            if allergies_table:
                cursor.execute(f"SELECT COUNT(*) FROM {allergies_table}")
                allergy_count = cursor.fetchone()[0]
                print(f"  [COUNT] Total allergies in database: {allergy_count}")
                
                if allergy_count > 0:
                    cursor.execute(f"SELECT id, name FROM {allergies_table} LIMIT 5")
                    sample_allergies = cursor.fetchall()
                    
                    print(f"  [SAMPLE] Sample allergies:")
                    for allergy in sample_allergies:
                        print(f"    - ID: {allergy[0]}, Name: {allergy[1]}")
                else:
                    print("  [WARNING] No allergies found in database!")
            else:
                print("  [ERROR] No allergies table found!")
        
        # Check if there are any CSV files with medicinal data
        print(f"\n[FILES] Checking for medicinal data files...")
        
        # Check for CSV files in the project
        csv_files = []
        for root, dirs, files in os.walk('..'):
            for file in files:
                if file.endswith('.csv') and ('med' in file.lower() or 'drug' in file.lower()):
                    csv_files.append(os.path.join(root, file))
        
        if csv_files:
            print(f"  [FOUND] Found {len(csv_files)} medicinal CSV files:")
            for csv_file in csv_files:
                print(f"    - {csv_file}")
        else:
            print("  [WARNING] No medicinal CSV files found!")
        
    except Exception as e:
        print(f"[ERROR] Error checking database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_medicinal_data()
