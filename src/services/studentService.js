import { Client, Databases, Query, ID, Functions, AppwriteException, Permission, Role } from 'appwrite';

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const functions = new Functions(client);

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const STUDENT_COLLECTION_ID = import.meta.env.VITE_APPWRITE_STUDENT_COLLECTION_ID;
const CREATE_USER_ID = import.meta.env.VITE_APPWRITE_CREATE_USER_FUNCTION_ID;
const DELETE_USER_ID = import.meta.env.VITE_APPWRITE_DELETE_USER_FUNCTION_ID;
const GET_USER_ID = import.meta.env.VITE_APPWRITE_GET_USER_ID_FUNCTION_ID;

export async function getUserIdByEmail (email){
  try {
    const execution = await functions.createExecution(
      GET_USER_ID,
      JSON.stringify({ email }),
      false
    );

    if (!execution.responseBody) {
      throw new Error('Function returned an empty response');
    }

    const response = JSON.parse(execution.responseBody);
    if (!response.success) {
      console.warn('⚠️ User not found for email:', email);
      return null;
    }

    return response.userId;
  } catch (err) {
    console.error('❌ Failed to fetch userId by email:', err);
    return null;
  }
};

export async function deleteUserByEmail (email){
  try {
      if (!email || typeof email !== 'string') {
          console.warn('⚠️ Invalid email provided for deletion:', email);
          return;
      }
      console.log('Sending delete request for email:', email);
      const payload = JSON.stringify({ email });
      console.log('Payload sent to deleteUserByEmail:', payload);
      console.log('Function ID:', DELETE_USER_ID);
      const execution = await functions.createExecution(
          DELETE_USER_ID,
          payload,
          false
      );

      console.log('Execution response:', execution);
      if (!execution.responseBody) {
          console.error('❌ Empty response from deleteUserByEmail function');
          console.log('Execution details:', JSON.stringify(execution, null, 2));
          throw new Error('Function returned an empty response');
      }

      const response = JSON.parse(execution.responseBody);
      console.log('Delete function response:', response);
      if (!response.success) {
          console.warn('⚠️ Failed to delete user:', response.error);
      } else {
          console.log('✅ User deleted via function:', email);
      }
  } catch (err) {
      console.error('❌ Failed to delete user by email:', err);
  }
};

export async function createUserForStudent (name, email,){
  const userId = ID.unique();
  const firstName = name.trim().split(' ')[0];
  const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  // Extract part before @ from email
  const localPart = email.split('@')[0];
  const lastTwoChars = localPart.slice(-2);
  const defaultPassword = `${capitalizedFirstName}@${lastTwoChars}#`;
  try {
    const payload = {
      email,
      name,
      password: defaultPassword,
      userId,
    };
    console.log('Sending payload to function:', payload);

    const execution = await functions.createExecution(
      CREATE_USER_ID,
      JSON.stringify(payload),
      false
    );

    console.log('Function execution response:', execution);

    if (!execution.responseBody) {
      throw new Error('Function returned an empty response');
    }

    let response;
    try {
      response = JSON.parse(execution.responseBody);
    } catch (parseError) {
      console.error('Failed to parse function response:', execution.responseBody);
      throw new Error('Invalid response from function: ' + (parseError instanceof Error ? parseError.message : 'Unknown parse error'));
    }

    if (!response.success) {
      throw new Error(response.error || 'Failed to create user via function');
    }

    console.log('✅ User created via function:', response.user);
    return response.user.userId;
  } catch (err) {
    const errorMessage = err instanceof AppwriteException ? err.message : err.message || 'Unknown error';
    console.error('❌ Failed to create user for student:', err);
    throw new Error('Failed to create user: ' + errorMessage);
  }
};

export async function getStudents() {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      STUDENT_COLLECTION_ID,
      [Query.orderDesc('$createdAt')]
    );
    return response;
  } catch (error) {
    throw new Error('Failed to fetch students: ' + error.message);
  }
}

export async function getStudent(studentId) {
  try {
    const response = await databases.getDocument(
      DATABASE_ID,
      STUDENT_COLLECTION_ID,
      studentId
    );
    return response;
  } catch (error) {
    throw new Error('Failed to fetch student: ' + error.message);
  }
}

export async function createStudent(studentData) {
  try {
    if (!studentData.Email) {
        throw new Error('Email is a required field.');
    }
    // Check for duplicate ABC_ID
    const existingStudents = await databases.listDocuments(
      DATABASE_ID,
      STUDENT_COLLECTION_ID,
      [Query.equal('ABC_ID', parseInt(studentData.ABC_ID))]
    );
    if (existingStudents.total > 0) {
      throw new Error('Student with this ABC ID already exists');
    }
    
    // Check for duplicate Email
    const existingEmails = await databases.listDocuments(
        DATABASE_ID,
        STUDENT_COLLECTION_ID,
        [Query.equal('Email', studentData.Email)]
    );
    if (existingEmails.total > 0) {
        throw new Error('Student with this email already exists');
    }

    const initialPermissions = [
        Permission.read(Role.label('admin')),
        Permission.update(Role.label('admin')),
        Permission.delete(Role.label('admin')),
      ];

    const response = await databases.createDocument(
      DATABASE_ID,
      STUDENT_COLLECTION_ID,
      ID.unique(),
      {
        Name: studentData.Name,
        Email: studentData.Email,
        Gender: studentData.Gender,
        ABC_ID: parseInt(studentData.ABC_ID),
        Status: studentData.Status,
        Course: studentData.Course || null,
        Semester: studentData.Semester ? parseInt(studentData.Semester) : null,
        Batch: studentData.Batch ? parseInt(studentData.Batch) : null,
        Year: studentData.Year || null,
        Address: studentData.Address || null,
      },
      initialPermissions
    );
    console.log('✅ Student added to collection:', response);

    
    // Attempt to create user in Appwrite Users service
    try {
      let userId = await getUserIdByEmail(studentData.Email);
      if (!userId) {
        userId = await createUserForStudent(studentData.Name, studentData.Email);
        console.log('✅ User created:', userId);
      }
      // Update the student document with the userId if needed

      const updatedPermissions = [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.read(Role.label('admin')),
        Permission.update(Role.label('admin')),
        Permission.delete(Role.label('admin')),
      ];
      await databases.updateDocument(
        DATABASE_ID,
        STUDENT_COLLECTION_ID,
        response.$id,
        {
          userId: userId, // Optionally store the userId in the student document
        },
        updatedPermissions
      );
      console.log('✅ User created and linked to student:', userId);
    } catch (userErr) {
      console.warn('⚠️ User creation failed, but student data is stored:', userErr);
      // No need to throw here; student data is already saved
    }
    return response;
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function updateStudent(studentId, studentData) {
  try {
    if (!studentData.Email) {
        throw new Error('Email is a required field.');
    }
    // Check for duplicate ABC_ID, excluding the current student
    const existingStudents = await databases.listDocuments(
      DATABASE_ID,
      STUDENT_COLLECTION_ID,
      [
        Query.equal('ABC_ID', parseInt(studentData.ABC_ID)),
        Query.notEqual('$id', studentId)
      ]
    );
    if (existingStudents.total > 0) {
      throw new Error('Another student with this ABC ID already exists');
    }
    
    const newUserId = await getUserIdByEmail(studentData.Email);
    console.log('New userId fetched:', newUserId);
    
    const permissions = newUserId
      ? [
          Permission.read(Role.user(newUserId)),
          Permission.update(Role.user(newUserId)),
          Permission.read(Role.label('admin')),
          Permission.update(Role.label('admin')),
          Permission.delete(Role.label('admin')),
        ]
      : [ 
          Permission.read(Role.label('admin')),
          Permission.update(Role.label('admin')),
          Permission.delete(Role.label('admin')),
        ];
    // Check for duplicate Email, excluding the current student
    const existingEmails = await databases.listDocuments(
        DATABASE_ID,
        STUDENT_COLLECTION_ID,
        [
            Query.equal('Email', studentData.Email),
            Query.notEqual('$id', studentId)
        ]
    );
    if (existingEmails.total > 0) {
        throw new Error('Another student with this email already exists');
    }

    const response = await databases.updateDocument(
      DATABASE_ID,
      STUDENT_COLLECTION_ID,
      studentId,
      {
        Name: studentData.Name,
        Gender: studentData.Gender,
        ABC_ID: parseInt(studentData.ABC_ID),
        Status: studentData.Status,
        Course: studentData.Course || null,
        Semester: studentData.Semester ? parseInt(studentData.Semester) : null,
        Batch: studentData.Batch ? parseInt(studentData.Batch) : null,
        Year: studentData.Year || null,
        Address: studentData.Address || null,
        Email: studentData.Email
      }, permissions
    );
    return response;
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function deleteStudent(studentId) {
  try {
    // Retrieve the student document to get the Email
      const studentDoc = await databases.getDocument(DATABASE_ID, STUDENT_COLLECTION_ID, studentId);
      const email = studentDoc.Email;

      // Delete the user from authentication service if email exists
      if (email) {
        await deleteUserByEmail(email);
      } else {
        console.warn('⚠️ No email found for student document:', studentId);
      }

      // Delete the student document
      await databases.deleteDocument(DATABASE_ID, STUDENT_COLLECTION_ID, studentId);
      console.log('✅ Student document deleted:', studentId);
  } catch (error) {
    throw new Error('Failed to delete student: ' + error.message);
  }
}