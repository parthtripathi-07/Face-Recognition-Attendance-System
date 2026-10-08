import asyncio
import json
import logging
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

logger = logging.getLogger('faceattend.database')

class MockAsyncCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = list(docs)
        self._pos = 0

    def sort(self, key_or_list, direction=1):
        if isinstance(key_or_list, str):
            key = key_or_list
            reverse = direction == -1
            self._docs.sort(key=lambda d: d.get(key, ''), reverse=reverse)
        elif isinstance(key_or_list, list):
            for k, d in reversed(key_or_list):
                self._docs.sort(key=lambda item: item.get(k, ''), reverse=(d == -1))
        return self

    def skip(self, n: int):
        self._docs = self._docs[n:]
        return self

    def limit(self, n: int):
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        if length is not None:
            return self._docs[:length]
        return list(self._docs)

    def __aiter__(self):
        self._pos = 0
        return self

    async def __anext__(self):
        if self._pos < len(self._docs):
            doc = self._docs[self._pos]
            self._pos += 1
            return doc
        raise StopAsyncIteration

class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id

class UpdateResult:
    def __init__(self, matched_count, modified_count):
        self.matched_count = matched_count
        self.modified_count = modified_count

class DeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count

def _matches_filter(doc: Dict[str, Any], filter_dict: Dict[str, Any]) -> bool:
    if not filter_dict:
        return True
    for key, val in filter_dict.items():
        if key == '$or':
            matched_any = False
            for sub in val:
                if _matches_filter(doc, sub):
                    matched_any = True
                    break
            if not matched_any:
                return False
            continue

        if key == '$and':
            for sub in val:
                if not _matches_filter(doc, sub):
                    return False
            continue

        doc_val = doc.get(key)
        if isinstance(val, dict):
            if '$regex' in val:
                pattern = val['$regex']
                flags = re.IGNORECASE if 'i' in val.get('$options', '') else 0
                if doc_val is None or not re.search(pattern, str(doc_val), flags):
                    return False
            if '$in' in val:
                if doc_val not in val['$in']:
                    return False
        else:
            if doc_val != val:
                return False
    return True

class ResilientCollection:
    def __init__(self, name: str, file_path: Path):
        self.name = name
        self.file_path = file_path
        self._lock = asyncio.Lock()
        self._data: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self):
        if self.file_path.exists():
            try:
                with open(self.file_path, 'r', encoding='utf-8') as f:
                    docs = json.load(f)
                    for d in docs:
                        _id = str(d.get('_id') or d.get('id') or uuid.uuid4().hex)
                        d['_id'] = _id
                        self._data[_id] = d
            except Exception as e:
                logger.error(f'Failed to load local storage for {self.name}: {e}')
                self._data = {}

    def _save(self):
        try:
            temp_path = self.file_path.with_suffix('.tmp')
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(list(self._data.values()), f, indent=2, default=str)
            temp_path.replace(self.file_path)
        except Exception as e:
            logger.error(f'Failed to persist local storage for {self.name}: {e}')

    async def find_one(self, filter: Dict[str, Any], projection: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        async with self._lock:
            for doc in self._data.values():
                if _matches_filter(doc, filter):
                    res = dict(doc)
                    if projection and projection.get('_id') == 0:
                        res.pop('_id', None)
                    return res
            return None

    def find(self, filter: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None) -> MockAsyncCursor:
        filter = filter or {}
        matches = []
        for doc in self._data.values():
            if _matches_filter(doc, filter):
                res = dict(doc)
                if projection and projection.get('_id') == 0:
                    res.pop('_id', None)
                matches.append(res)
        return MockAsyncCursor(matches)

    async def insert_one(self, document: Dict[str, Any]) -> InsertResult:
        async with self._lock:
            doc = dict(document)
            if '_id' not in doc:
                doc['_id'] = uuid.uuid4().hex
            self._data[str(doc['_id'])] = doc
            self._save()
            return InsertResult(doc['_id'])

    async def insert_many(self, documents: List[Dict[str, Any]]) -> List[Any]:
        async with self._lock:
            ids = []
            for d in documents:
                doc = dict(d)
                if '_id' not in doc:
                    doc['_id'] = uuid.uuid4().hex
                self._data[str(doc['_id'])] = doc
                ids.append(doc['_id'])
            self._save()
            return ids

    async def update_one(self, filter: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> UpdateResult:
        async with self._lock:
            matched_id = None
            for _id, doc in self._data.items():
                if _matches_filter(doc, filter):
                    matched_id = _id
                    break

            if matched_id:
                doc = self._data[matched_id]
                if "$set" in update:
                    doc.update(update["$set"])
                if "$inc" in update:
                    for k, inc_val in update["$inc"].items():
                        doc[k] = doc.get(k, 0) + inc_val
                if "$unset" in update:
                    for k in update["$unset"]:
                        doc.pop(k, None)
                doc["updatedAt"] = datetime.now().isoformat()
                self._save()
                return UpdateResult(1, 1)
            elif upsert:
                new_doc = dict(filter)
                if "$set" in update:
                    new_doc.update(update["$set"])
                if "_id" not in new_doc:
                    new_doc["_id"] = uuid.uuid4().hex
                new_doc["createdAt"] = datetime.now().isoformat()
                new_doc["updatedAt"] = new_doc["createdAt"]
                self._data[str(new_doc["_id"])] = new_doc
                self._save()
                return UpdateResult(0, 1)
            return UpdateResult(0, 0)

    async def delete_one(self, filter: Dict[str, Any]) -> DeleteResult:
        async with self._lock:
            matched_id = None
            for _id, doc in self._data.items():
                if _matches_filter(doc, filter):
                    matched_id = _id
                    break
            if matched_id:
                del self._data[matched_id]
                self._save()
                return DeleteResult(1)
            return DeleteResult(0)

    async def delete_many(self, filter: Dict[str, Any]) -> DeleteResult:
        async with self._lock:
            to_delete = [
                _id for _id, doc in self._data.items()
                if _matches_filter(doc, filter)
            ]
            for _id in to_delete:
                del self._data[_id]
            if to_delete:
                self._save()
            return DeleteResult(len(to_delete))

    async def count_documents(self, filter: Optional[Dict[str, Any]] = None) -> int:
        filter = filter or {}
        count = sum(1 for doc in self._data.values() if _matches_filter(doc, filter))
        return count

class DatabaseManager:
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.pg_pool = None
        self.db = None
        self.mode = 'uninitialized'
        self._pg_collections = {}
        self._fallback_collections: Dict[str, ResilientCollection] = {}

    async def connect(self):
        # 1. Try PostgreSQL if configured
        if settings.DB_BACKEND in ('postgres', 'auto') and settings.POSTGRES_URL:
            try:
                import asyncpg
                from app.postgres_adapter import PostgresCollection
                logger.info(f"Connecting to PostgreSQL database '{settings.POSTGRES_DB}' on {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}...")
                self.pg_pool = await asyncpg.create_pool(
                    user=settings.POSTGRES_USER,
                    password=settings.POSTGRES_PASSWORD,
                    database=settings.POSTGRES_DB,
                    host=settings.POSTGRES_HOST,
                    port=settings.POSTGRES_PORT,
                    min_size=1,
                    max_size=10,
                    command_timeout=10
                )
                colls = ['students', 'attendance', 'admins', 'face_embeddings', 'sessions', 'settings']
                for c in colls:
                    pg_col = PostgresCollection(self.pg_pool, c)
                    await pg_col.init_table()
                    self._pg_collections[c] = pg_col
                
                # Check student count; seed from JSON storage if needed
                st_count = await self._pg_collections['students'].count_documents({})
                if st_count == 0:
                    await self._seed_postgres_from_storage()

                self.mode = 'postgres'
                logger.info(f"Connected to PostgreSQL successfully! Mode: {self.mode}")
                return
            except Exception as e:
                logger.warning(f"PostgreSQL connection failed ({e}). Falling back to next engine...")

        # 2. Try MongoDB
        if settings.DB_BACKEND in ('mongodb', 'auto'):
            try:
                logger.info(f'Connecting to MongoDB at: {settings.MONGODB_URI}...')
                client = AsyncIOMotorClient(
                    settings.MONGODB_URI,
                    serverSelectionTimeoutMS=2000
                )
                await client.admin.command('ping')
                self.client = client
                self.db = client[settings.MONGODB_DB_NAME]
                self.mode = 'mongodb'
                logger.info('Connected to MongoDB successfully!')
                await self._ensure_indexes()
                return
            except Exception as e:
                logger.warning(f'MongoDB connection failed ({e}). Activating Resilient Local Storage Engine.')

        # 3. Fallback to Local Storage
        self.mode = 'fallback'
        self._init_fallback()
        logger.info("Resilient Local Storage Engine activated.")

    async def _seed_postgres_from_storage(self):
        storage_dir = settings.STORAGE_DIR
        if not storage_dir.exists():
            return
        colls = ['students', 'attendance', 'admins', 'face_embeddings', 'sessions', 'settings']
        for c in colls:
            json_file = storage_dir / f"{c}.json"
            if json_file.exists():
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        docs = json.load(f)
                        for d in docs:
                            await self._pg_collections[c].insert_one(d)
                    logger.info(f"Seeded {len(docs)} records into PostgreSQL table app_{c}")
                except Exception as ex:
                    logger.warning(f"Notice during seeding app_{c}: {ex}")

    def _init_fallback(self):
        storage_dir = settings.STORAGE_DIR
        storage_dir.mkdir(parents=True, exist_ok=True)
        colls = ['students', 'attendance', 'admins', 'face_embeddings', 'sessions', 'settings']
        for c in colls:
            self._fallback_collections[c] = ResilientCollection(c, storage_dir / f'{c}.json')

    def __getitem__(self, collection_name: str):
        if self.mode == 'postgres' and self._pg_collections:
            if collection_name not in self._pg_collections:
                from app.postgres_adapter import PostgresCollection
                self._pg_collections[collection_name] = PostgresCollection(self.pg_pool, collection_name)
            return self._pg_collections[collection_name]
        if self.mode == 'mongodb' and self.db is not None:
            return self.db[collection_name]
        if collection_name not in self._fallback_collections:
            self._fallback_collections[collection_name] = ResilientCollection(
                collection_name, settings.STORAGE_DIR / f'{collection_name}.json'
            )
        return self._fallback_collections[collection_name]

    async def _ensure_indexes(self):
        if self.mode == 'mongodb' and self.db is not None:
            try:
                await self.db.students.create_index('studentId', unique=True)
                await self.db.students.create_index('rollNumber', unique=True)
                await self.db.admins.create_index('username', unique=True)
                await self.db.face_embeddings.create_index('studentId', unique=True)
                await self.db.attendance.create_index([('studentId', 1), ('date', 1), ('sessionId', 1)])
            except Exception as ex:
                logger.warning(f'Indexes already exist or skipped: {ex}')

    async def close(self):
        if self.pg_pool:
            await self.pg_pool.close()
            logger.info("PostgreSQL connection pool closed.")
        if self.client:
            self.client.close()
            logger.info('Database connection closed.')

db_manager = DatabaseManager()

def get_db():
    return db_manager
