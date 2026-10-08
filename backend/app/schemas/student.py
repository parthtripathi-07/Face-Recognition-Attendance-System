from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class StudentBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description='Student full name')
    rollNumber: str = Field(..., min_length=1, max_length=50, description='Unique Roll / Registration Number')
    email: Optional[EmailStr] = Field(None, description='Student email address')
    phone: Optional[str] = Field(None, max_length=20, description='Contact phone number')
    branch: str = Field(..., min_length=1, max_length=50, description='Department/Branch, e.g. CSE')
    year: str = Field(..., min_length=1, max_length=20, description='Academic Year, e.g. 1st Year, 2nd Year, 3rd Year')
    section: Optional[str] = Field(None, max_length=10, description='Section, e.g. A, B')
    studentId: Optional[str] = Field(None, max_length=50, description='Custom or auto-generated student ID')

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    rollNumber: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    branch: Optional[str] = None
    year: Optional[str] = None
    section: Optional[str] = None

class StudentResponse(BaseModel):
    id: str
    studentId: str
    name: str
    rollNumber: str
    email: Optional[str] = None
    phone: Optional[str] = None
    branch: str
    year: str
    section: Optional[str] = None
    faceRegistered: bool = False
    samplesCount: int = 0
    createdAt: str
    updatedAt: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
