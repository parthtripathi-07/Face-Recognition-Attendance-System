import asyncio
import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple
import asyncpg
from app.config import settings

logger = logging.getLogger("faceattend.postgres_adapter")

def build_where_clause(filter_dict: Dict[str, Any], param_offset: int = 1) -> Tuple[str, List[Any]]:
    if not filter_dict:
        return "1=1", []

    conditions = []
    params = []
    idx = param_offset

    for k, v in filter_dict.items():
        if k == "$or" and isinstance(v, list):
            or_parts = []
            for sub_filter in v:
                sub_cond, sub_params = build_where_clause(sub_filter, idx)
                or_parts.append(f"({sub_cond})")
                params.extend(sub_params)
                idx += len(sub_params)
            if or_parts:
                conditions.append(f"({' OR '.join(or_parts)})")
        elif k == "_id" or k == "id":
            conditions.append(f"id = ${idx}")
            params.append(str(v))
            idx += 1
        elif isinstance(v, dict):
            if "$regex" in v:
                pattern = v["$regex"]
                flags = v.get("$options", "")
                op = "~*" if "i" in flags else "~"
                conditions.append(f"doc->>'{k}' {op} ${idx}")
                params.append(pattern)
                idx += 1
            elif "$in" in v:
                in_list = v["$in"]
                placeholders = [f"${idx + i}" for i in range(len(in_list))]
                conditions.append(f"doc->>'{k}' IN ({', '.join(placeholders)})")
                params.extend([str(item) for item in in_list])
                idx += len(in_list)
        elif isinstance(v, bool):
            conditions.append(f"(doc->>'{k}')::boolean = ${idx}")
            params.append(v)
            idx += 1
        elif isinstance(v, (int, float)):
            conditions.append(f"(doc->>'{k}')::numeric = ${idx}")
            params.append(v)
            idx += 1
        elif v is None:
            conditions.append(f"(doc->>'{k}' IS NULL OR doc->'{k}' = 'null'::jsonb)")
        else:
            conditions.append(f"doc->>'{k}' = ${idx}")
            params.append(str(v))
            idx += 1

    where_str = " AND ".join(conditions) if conditions else "1=1"
    return where_str, params

class PostgresCursor:
    def __init__(self, pool: asyncpg.Pool, table_name: str, filter_dict: Dict[str, Any]):
        self.pool = pool
        self.table_name = table_name
        self.filter_dict = filter_dict or {}
        self._sort_key = None
        self._sort_dir = "ASC"
        self._skip = 0
        self._limit = None

    def sort(self, key_or_list, direction=1):
        if isinstance(key_or_list, str):
            self._sort_key = key_or_list
            self._sort_dir = "DESC" if direction == -1 else "ASC"
        elif isinstance(key_or_list, list) and key_or_list:
            k, d = key_or_list[0]
            self._sort_key = k
            self._sort_dir = "DESC" if d == -1 else "ASC"
        return self

    def skip(self, n: int):
        self._skip = max(0, n)
        return self

    def limit(self, n: int):
        self._limit = max(0, n)
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        limit_val = length if length is not None else self._limit
        where_clause, params = build_where_clause(self.filter_dict)
        
        query = f"SELECT doc FROM {self.table_name} WHERE {where_clause}"
        if self._sort_key:
            if self._sort_key in ("_id", "id", "createdAt", "created_at"):
                query += f" ORDER BY created_at {self._sort_dir}"
            else:
                query += f" ORDER BY doc->>'{self._sort_key}' {self._sort_dir}"
        else:
            query += " ORDER BY created_at DESC"

        if limit_val is not None:
            query += f" LIMIT {int(limit_val)}"
        if self._skip > 0:
            query += f" OFFSET {int(self._skip)}"

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            results = []
            for r in rows:
                doc = json.loads(r["doc"]) if isinstance(r["doc"], str) else dict(r["doc"])
                results.append(doc)
            return results

    def __aiter__(self):
        self._iter_cache = None
        self._pos = 0
        return self

    async def __anext__(self):
        if self._iter_cache is None:
            self._iter_cache = await self.to_list(1000)
        if self._pos < len(self._iter_cache):
            doc = self._iter_cache[self._pos]
            self._pos += 1
            return doc
        raise StopAsyncIteration

class PostgresCollection:
    def __init__(self, pool: asyncpg.Pool, collection_name: str):
        self.pool = pool
        self.collection_name = collection_name
        self.table_name = f"app_{collection_name}"

    async def init_table(self):
        async with self.pool.acquire() as conn:
            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.table_name} (
                    id VARCHAR(64) PRIMARY KEY,
                    doc JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_{self.table_name}_gin ON {self.table_name} USING gin (doc);
            """)

    def find(self, filter_dict: Optional[Dict[str, Any]] = None, projection=None) -> PostgresCursor:
        return PostgresCursor(self.pool, self.table_name, filter_dict or {})

    async def find_one(self, filter_dict: Dict[str, Any], projection=None) -> Optional[Dict[str, Any]]:
        cursor = self.find(filter_dict)
        docs = await cursor.limit(1).to_list(1)
        return docs[0] if docs else None

    async def count_documents(self, filter_dict: Optional[Dict[str, Any]] = None) -> int:
        where_clause, params = build_where_clause(filter_dict or {})
        query = f"SELECT COUNT(*) FROM {self.table_name} WHERE {where_clause}"
        async with self.pool.acquire() as conn:
            count = await conn.fetchval(query, *params)
            return int(count)

    async def insert_one(self, doc: Dict[str, Any]):
        doc_copy = dict(doc)
        doc_id = str(doc_copy.get("_id") or doc_copy.get("id") or uuid.uuid4().hex)
        doc_copy["_id"] = doc_id
        
        doc_json = json.dumps(doc_copy)
        query = f"""
            INSERT INTO {self.table_name} (id, doc)
            VALUES ($1, $2::jsonb)
            ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc;
        """
        async with self.pool.acquire() as conn:
            await conn.execute(query, doc_id, doc_json)

        class InsertResult:
            inserted_id = doc_id
        return InsertResult()

    async def update_one(self, filter_dict: Dict[str, Any], update_dict: Dict[str, Any], upsert: bool = False):
        existing = await self.find_one(filter_dict)
        if not existing:
            if upsert:
                new_doc = dict(filter_dict)
                if "$set" in update_dict:
                    new_doc.update(update_dict["$set"])
                await self.insert_one(new_doc)
            return

        updated_doc = dict(existing)
        if "$set" in update_dict:
            updated_doc.update(update_dict["$set"])
        if "$inc" in update_dict:
            for k, inc_val in update_dict["$inc"].items():
                updated_doc[k] = updated_doc.get(k, 0) + inc_val

        doc_id = updated_doc.get("_id") or existing.get("_id")
        doc_json = json.dumps(updated_doc)
        
        async with self.pool.acquire() as conn:
            await conn.execute(
                f"UPDATE {self.table_name} SET doc = $1::jsonb WHERE id = $2",
                doc_json, doc_id
            )

    async def delete_one(self, filter_dict: Dict[str, Any]):
        existing = await self.find_one(filter_dict)
        if existing:
            doc_id = existing.get("_id")
            async with self.pool.acquire() as conn:
                await conn.execute(f"DELETE FROM {self.table_name} WHERE id = $1", doc_id)

    async def delete_many(self, filter_dict: Dict[str, Any]):
        where_clause, params = build_where_clause(filter_dict)
        query = f"DELETE FROM {self.table_name} WHERE {where_clause}"
        async with self.pool.acquire() as conn:
            await conn.execute(query, *params)
