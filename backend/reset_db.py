from dotenv import load_dotenv
load_dotenv()

import database, models

print("Dropping all tables...")
models.Base.metadata.drop_all(bind=database.engine)

print("Recreating all tables...")
models.Base.metadata.create_all(bind=database.engine)

print("Database reset successful.")
