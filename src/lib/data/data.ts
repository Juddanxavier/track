/** @format */

import { faker } from '@faker-js/faker';

export type User = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export const createUser = (numUsers: number) => {
  const users: User[] = [];
  for (let i = 0; i < numUsers; i++) {
    users.push({
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      role: faker.helpers.arrayElement(['admin', 'customer']),
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.past().toISOString(),
    });
  }
  return users;
};
