export * from './auth.service';
import { AuthService } from './auth.service';
export * from './health.service';
import { HealthService } from './health.service';
export * from './todos.service';
import { TodosService } from './todos.service';
export * from './users.service';
import { UsersService } from './users.service';
export const APIS = [AuthService, HealthService, TodosService, UsersService];
